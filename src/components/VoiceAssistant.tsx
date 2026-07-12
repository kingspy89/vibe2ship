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
  const [micError, setMicError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startLiveSession = async () => {
    setIsActive(true);
    setIsConnecting(true);
    setMicError(null);
    try {
      let wsUrl = import.meta.env.VITE_WS_URL;
      if (!wsUrl) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/api/live`;
      } else if (wsUrl.startsWith('/')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}${wsUrl}`;
      }
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsConnecting(false);

        try {
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
        } catch (audioErr) {
          console.warn("Voice assistant started without microphone input:", audioErr);
          setMicError("Microphone access unavailable or blocked.");
        }

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
      };

    } catch (e) {
      console.error("Failed to start voice assistant WebSocket", e);
      setMicError("Could not connect to voice server.");
      setIsConnecting(false);
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
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
    setMicError(null);
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
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes soundWave {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(1); }
        }
        .waveform-bar {
          animation: soundWave 1.2s ease-in-out infinite;
          transform-origin: center;
        }
      `}} />

      {/* Floating Assistant Control Panel */}
      {(isActive || isConnecting) && (
        <div className="fixed bottom-24 right-6 w-80 bg-[#1C1D26] border border-slate-800 rounded-2xl p-5 shadow-2xl z-50 flex flex-col space-y-4 transition-all duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isConnecting ? "bg-amber-400" : "bg-emerald-400"
                )}></span>
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isConnecting ? "bg-amber-500" : "bg-emerald-500"
                )}></span>
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {isConnecting ? "Connecting to AI..." : "Civic AI Active"}
              </span>
            </div>
            <button 
              onClick={stopLiveSession} 
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-2 py-1 rounded transition-colors"
            >
              Disconnect
            </button>
          </div>

          {/* Waveform Visualization */}
          <div className="flex flex-col items-center justify-center py-4 bg-[#12131A] rounded-xl border border-slate-800/60 relative overflow-hidden">
            {micError ? (
              <div className="text-center px-4 py-2">
                <p className="text-xs text-amber-500 font-semibold mb-1">⚠️ Audio Input Disabled</p>
                <p className="text-[10px] text-slate-400 leading-normal">
                  {micError}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-1.5 h-12 w-full px-8">
                <div className="w-1 bg-indigo-500 rounded-full h-8 waveform-bar" style={{ animationDelay: '0.1s' }} />
                <div className="w-1 bg-indigo-500 rounded-full h-8 waveform-bar" style={{ animationDelay: '0.35s' }} />
                <div className="w-1 bg-indigo-400 rounded-full h-8 waveform-bar" style={{ animationDelay: '0.2s' }} />
                <div className="w-1 bg-indigo-500 rounded-full h-8 waveform-bar" style={{ animationDelay: '0.5s' }} />
                <div className="w-1 bg-indigo-400 rounded-full h-8 waveform-bar" style={{ animationDelay: '0.15s' }} />
                <div className="w-1 bg-indigo-500 rounded-full h-8 waveform-bar" style={{ animationDelay: '0.4s' }} />
                <div className="w-1 bg-indigo-500 rounded-full h-8 waveform-bar" style={{ animationDelay: '0.25s' }} />
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              {isConnecting ? "Establishing voice stream..." : micError ? "Text-only Assistance Active" : "Try speaking to report or query issues"}
            </p>
          </div>

          {/* Helper Suggestions */}
          <div className="space-y-2">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Suggested Queries</p>
            <div className="flex flex-col gap-1.5">
              {[
                "\"Report a new garbage issue nearby\"",
                "\"What is my current level and XP?\"",
                "\"Show me the community leaderboard\"",
              ].map((phrase, i) => (
                <div 
                  key={i} 
                  className="text-xs text-slate-300 bg-[#12131A] hover:bg-slate-800 border border-slate-800/50 p-2 rounded-lg cursor-pointer transition-colors leading-tight font-mono text-center"
                  onClick={() => {
                    // Let user know they can speak it
                    console.log("User suggested to speak:", phrase);
                  }}
                >
                  {phrase}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={toggleAssistant}
        disabled={isConnecting}
        className={cn(
          "fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center z-50",
          isActive ? "bg-red-500 hover:bg-red-600 animate-pulse border border-red-400/40" : "bg-indigo-600 hover:bg-indigo-700 border border-indigo-500/40",
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
    </>
  );
}
