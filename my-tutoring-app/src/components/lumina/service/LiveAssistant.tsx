
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ExhibitData, WalkThroughRequest, WalkThroughProgress } from '../types';

interface LiveAssistantProps {
  exhibitData: ExhibitData;
  walkThroughRequest?: WalkThroughRequest | null;
  onWalkThroughProgress?: (progress: WalkThroughProgress) => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

export const LiveAssistant: React.FC<LiveAssistantProps> = ({
  exhibitData,
  walkThroughRequest,
  onWalkThroughProgress
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [walkThroughState, setWalkThroughState] = useState<{
    isActive: boolean;
    currentSection: 'brief' | 'objectives';
    currentObjectiveIndex: number | null;
    content: { brief: string; objectives: string[] } | null;
  }>({
    isActive: false,
    currentSection: 'brief',
    currentObjectiveIndex: null,
    content: null
  });
  
  // Audio Contexts & Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Session Management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  const disconnect = () => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            try { session.close(); } catch(e) {}
        });
        sessionPromiseRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
  };

  // Handle Walk-Through Requests
  useEffect(() => {
    if (!walkThroughRequest || walkThroughState.isActive) return;

    console.log('[LiveAssistant] Starting walk-through:', walkThroughRequest);

    // Auto-expand panel
    setIsExpanded(true);

    // Store walk-through content
    setWalkThroughState({
      isActive: true,
      currentSection: 'brief',
      currentObjectiveIndex: null,
      content: {
        brief: walkThroughRequest.content.brief || '',
        objectives: walkThroughRequest.content.objectives || []
      }
    });

    // Connect if not already connected
    if (!isConnected) {
      connect().then(() => {
        // Wait a bit for connection to stabilize, then send instruction
        setTimeout(() => sendWalkThroughInstruction(), 1000);
      });
    } else {
      sendWalkThroughInstruction();
    }
  }, [walkThroughRequest]);

  const connect = async () => {
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      // 1. Initialize AudioContext (Let browser decide sample rate to avoid NotSupportedError)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      // 2. Output Analysis (Visualizer)
      analyserRef.current = audioCtx.createAnalyser();
      analyserRef.current.fftSize = 32;
      analyserRef.current.smoothingTimeConstant = 0.5;

      // 3. Input Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 4. Context Injection
      const contextSummary = `
        You are an expert museum curator for an exhibit about "${exhibitData.topic}".
        
        Exhibit Briefing:
        "${exhibitData.intro.hook}"
        
        Learning Objectives:
        ${exhibitData.intro.objectives.map(o => `- ${o}`).join('\n')}
        
        Key Artifacts: 
        ${exhibitData.cards.map(c => `${c.title}: ${c.definition}`).join('\n')}

        Deep Dive Topic: ${exhibitData.featureExhibit.title}
        
        INSTRUCTIONS:
        - Answer the visitor's questions verbally.
        - Keep responses concise (2-3 sentences) unless asked for detail.
        - Be engaging, scholarly, but accessible.
        - If the user asks about something unrelated, politely steer them back to the exhibit.
      `;

      // 5. Connect to Gemini Live
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Live Session Opened');
            setIsConnected(true);
            setupAudioProcessing(audioCtx, stream);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && audioContextRef.current) {
              setIsSpeaking(true);
              // Auto-reset speaking state after a rough duration estimate if no new chunks come
              if ((window as any).speakingTimeout) clearTimeout((window as any).speakingTimeout);
              (window as any).speakingTimeout = setTimeout(() => setIsSpeaking(false), 1500);

              // Decode and Play
              const ctx = audioContextRef.current;
              // Ensure we schedule next chunk after the previous one finishes
              const currentTime = ctx.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                  nextStartTimeRef.current = currentTime;
              }

              try {
                  // Create buffer at 24kHz (Gemini Native Output)
                  // The browser's AudioContext (running at 44.1/48k) will handle playback resampling automatically
                  const audioBuffer = await decodeAudioData(
                    decodeBase64(base64Audio),
                    ctx,
                    24000 
                  );

                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  
                  // Route: Source -> Analyser -> Destination
                  source.connect(analyserRef.current!);
                  analyserRef.current!.connect(ctx.destination);
                  
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
              } catch (e) {
                  console.error("Audio decoding error", e);
              }
            }
          },
          onclose: () => {
            console.log('Session Closed');
            disconnect();
          },
          onerror: (err: any) => {
            console.error('Session Error', err);
            setError("Connection error.");
            disconnect();
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: contextSummary,
            // Turn off thinking for lower latency in conversation
            thinkingConfig: { thinkingBudget: 0 }
        }
      };

      sessionPromiseRef.current = ai.live.connect(config);
      
      // Start Visualizer Loop
      visualize();

    } catch (error) {
      console.error("Failed to connect to Live API", error);
      setError("Could not access microphone or connect.");
      disconnect();
    }
  };

  // --- Audio Processing & Resampling ---

  const setupAudioProcessing = (ctx: AudioContext, stream: MediaStream) => {
      if (!sessionPromiseRef.current) return;

      const source = ctx.createMediaStreamSource(stream);
      // Buffer size 4096 provides a balance between latency and performance for JS processing
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const currentSampleRate = ctx.sampleRate;
          
          // Resample from System Rate (e.g. 48000) to Gemini Rate (16000)
          const downsampledData = downsampleTo16k(inputData, currentSampleRate);
          
          // Create PCM Blob
          const pcmData = createPCM16Blob(downsampledData);

          // Send
          if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                session.sendRealtimeInput({ 
                    media: {
                        mimeType: 'audio/pcm;rate=16000',
                        data: pcmData
                    } 
                });
            });
          }
      };

      source.connect(processor);
      // ScriptProcessor needs to be connected to destination to fire events, 
      // but we don't want to hear ourselves, so we connect to a gain node with 0 gain.
      const muteNode = ctx.createGain();
      muteNode.gain.value = 0;
      processor.connect(muteNode);
      muteNode.connect(ctx.destination);

      sourceRef.current = source;
      processorRef.current = processor;
  };

  // --- Helpers ---

  function downsampleTo16k(inputData: Float32Array, inputSampleRate: number): Int16Array {
      if (inputSampleRate === 16000) {
          return floatTo16BitPCM(inputData);
      }

      const ratio = inputSampleRate / 16000;
      const newLength = Math.floor(inputData.length / ratio);
      const result = new Int16Array(newLength);

      for (let i = 0; i < newLength; i++) {
          // Simple decimation with linear interpolation to avoid aliasing artifacts significantly
          const offset = i * ratio;
          const nextOffset = (i + 1) * ratio;
          let sum = 0;
          let count = 0;
          
          // Average samples within the window for smoother downsampling
          for (let j = Math.floor(offset); j < Math.ceil(nextOffset) && j < inputData.length; j++) {
             sum += inputData[j];
             count++;
          }
          
          const value = count > 0 ? sum / count : 0;
          result[i] = Math.max(-1, Math.min(1, value)) * 32768;
      }
      return result;
  }

  function floatTo16BitPCM(input: Float32Array): Int16Array {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return output;
  }

  function createPCM16Blob(data: Int16Array): string {
      const bytes = new Uint8Array(data.buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
  }

  function decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    targetSampleRate: number
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const numChannels = 1;
    const frameCount = dataInt16.length; // Since 1 channel
    
    // Create buffer with the target rate (24000 for Gemini Output)
    // The AudioContext will resample this on playback if it differs from ctx.sampleRate
    const buffer = ctx.createBuffer(numChannels, frameCount, targetSampleRate);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }

  // --- Visualizer ---
  const visualize = () => {
    if (!analyserRef.current || !isConnected) {
        // If disconnected, stop loop
        if (isConnected) animationFrameRef.current = requestAnimationFrame(visualize);
        return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    let sum = 0;
    for(let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;
    // Smooth damping
    setVolume(prev => prev * 0.8 + average * 0.2);

    animationFrameRef.current = requestAnimationFrame(visualize);
  };

  // --- Walk-Through Functions ---
  const sendWalkThroughInstruction = async () => {
    if (!walkThroughState.content || !sessionPromiseRef.current) {
      console.warn('[LiveAssistant] Cannot send walk-through: missing content or session');
      return;
    }

    const { brief, objectives } = walkThroughState.content;

    console.log('[LiveAssistant] Sending walk-through instruction');
    console.log(`Brief: ${brief}`);
    console.log(`Objectives: ${objectives.join(', ')}`);

    try {
      const session = await sessionPromiseRef.current;

      // Create walk-through instruction text
      const instruction = `Please walk me through this exhibit. First explain the briefing: "${brief.substring(0, 100)}". Then explain each learning objective one by one.`;

      // Use Web Speech API to synthesize the instruction as audio
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(instruction);
        utterance.rate = 1.2; // Speak faster
        utterance.volume = 0.7; // Lower volume

        // Capture the synthesized audio
        // Note: This is a simplified approach - in production you'd want to capture the actual audio
        speechSynthesis.speak(utterance);

        console.log('[LiveAssistant] Walk-through instruction spoken via TTS');
      } else {
        console.warn('[LiveAssistant] Speech synthesis not available');

        // Fallback: Send a simple text prompt using session.send if available
        try {
          // Try the standard send method with text content
          if (typeof session.send === 'function') {
            await session.send(instruction);
            console.log('[LiveAssistant] Walk-through instruction sent as text');
          }
        } catch (sendError) {
          console.warn('[LiveAssistant] Could not send text instruction:', sendError);
        }
      }

      // Start progress simulation
      startProgressSimulation();
    } catch (error) {
      console.error('[LiveAssistant] Error sending walk-through instruction:', error);
      startProgressSimulation(); // Start anyway for visual feedback
    }
  };

  const startProgressSimulation = () => {
    if (!walkThroughState.content) return;

    const { brief, objectives } = walkThroughState.content;

    // Estimate timing: ~3s for brief, ~5s per objective
    const briefDuration = 3000;
    const objectiveDuration = 5000;

    let elapsed = 0;

    // Start with brief
    if (onWalkThroughProgress) {
      onWalkThroughProgress({
        section: 'brief',
        objectiveIndex: null
      });
    }

    progressTimerRef.current = setInterval(() => {
      elapsed += 1000;

      if (elapsed < briefDuration) {
        // Still on brief
        setWalkThroughState(prev => ({
          ...prev,
          currentSection: 'brief',
          currentObjectiveIndex: null
        }));
      } else {
        // On objectives
        const objectiveElapsed = elapsed - briefDuration;
        const currentObjIndex = Math.floor(objectiveElapsed / objectiveDuration);

        if (currentObjIndex < objectives.length) {
          setWalkThroughState(prev => ({
            ...prev,
            currentSection: 'objectives',
            currentObjectiveIndex: currentObjIndex
          }));

          if (onWalkThroughProgress) {
            onWalkThroughProgress({
              section: 'objectives',
              objectiveIndex: currentObjIndex
            });
          }
        } else {
          // Completed
          console.log('[LiveAssistant] Walk-through complete');

          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }

          setWalkThroughState(prev => ({
            ...prev,
            isActive: false
          }));

          if (onWalkThroughProgress) {
            onWalkThroughProgress({
              section: 'objectives',
              objectiveIndex: objectives.length - 1,
              isComplete: true
            });
          }
        }
      }
    }, 1000);
  };

  // --- Render ---

  // Collapsed State (only show button if not connected AND no walk-through active)
  if (!isConnected && !walkThroughState.isActive) {
    return (
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2">
          {error && (
              <div className="bg-red-500/90 text-white text-xs px-3 py-2 rounded-lg max-w-[200px] shadow-lg animate-fade-in">
                  {error}
              </div>
          )}
          <button
            onClick={connect}
            className="group flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-blue-500/30 p-4 rounded-full shadow-2xl hover:bg-blue-600 hover:border-blue-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:-translate-y-1"
          >
            <div className="relative">
                <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                <svg className="w-6 h-6 text-blue-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            </div>
            <span className="text-sm font-bold text-blue-100 group-hover:text-white pr-2">
                Ask Curator
            </span>
          </button>
      </div>
    );
  }

  // Expanded State
  return (
    <div className="fixed bottom-6 left-6 z-50 animate-fade-in-up">
      <div className="glass-panel p-6 rounded-3xl border border-blue-500/40 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col gap-5 w-80 bg-slate-900/95 backdrop-blur-xl">
         
         {/* Header */}
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-300">Live Curator</span>
            </div>
            <button 
                onClick={disconnect} 
                className="p-2 -m-2 text-slate-500 hover:text-red-400 transition-colors rounded-full hover:bg-white/5"
                title="End Session"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
         </div>

         {/* Walk-Through Content Card */}
         {walkThroughState.isActive && walkThroughState.content && (
           <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-blue-500/30 animate-fade-in">
             <div className="flex items-center gap-2 mb-2">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
               <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">
                 Currently Explaining
               </div>
             </div>

             {walkThroughState.currentSection === 'brief' ? (
               <div className="text-sm text-slate-200">
                 <div className="font-semibold text-blue-400 mb-1">Briefing</div>
                 <p className="text-slate-300 leading-relaxed">
                   {walkThroughState.content.brief}
                 </p>
               </div>
             ) : (
               <div className="text-sm text-slate-200">
                 <div className="font-semibold text-blue-400 mb-1">
                   Learning Objective {(walkThroughState.currentObjectiveIndex ?? 0) + 1}
                 </div>
                 <p className="text-slate-300 leading-relaxed">
                   {walkThroughState.content.objectives[
                     walkThroughState.currentObjectiveIndex ?? 0
                   ]}
                 </p>
               </div>
             )}
           </div>
         )}

         {/* Visualizer */}
         <div className="h-24 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-center gap-1.5 overflow-hidden shadow-inner relative">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-blue-500/5"></div>
            
            {/* Bars */}
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div 
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-blue-600 to-cyan-300 rounded-full transition-all duration-100 ease-out"
                    style={{ 
                        height: `${Math.max(10, Math.min(80, volume * (Math.sin(i) + 1.5)))}%`,
                        opacity: 0.6 + (volume / 300)
                    }}
                ></div>
            ))}
         </div>

         {/* Status & Controls */}
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-colors duration-300
                    ${isSpeaking ? 'bg-blue-500 scale-110' : 'bg-slate-700'}
                `}>
                    {isSpeaking ? (
                        <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                    )}
                </div>
                <div>
                    <p className="text-sm text-white font-medium transition-all duration-300">
                        {isSpeaking ? "Speaking..." : "Listening..."}
                    </p>
                </div>
            </div>
            
            {/* Mic Toggle Visualization (Static for now, implies active mic) */}
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Microphone Active"></div>
         </div>
         
      </div>
    </div>
  );
};
