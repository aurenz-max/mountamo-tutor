import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw, RotateCcw, Volume2 } from 'lucide-react';
import { MediaPlayerData } from '../types';
import { base64ToAudioBuffer, getAudioContext } from '../utils/audioUtils';

interface MediaPlayerProps {
  data: MediaPlayerData;
  className?: string;
}

/**
 * MediaPlayer - Audio-visual lesson player with synchronized narration and images
 *
 * Features:
 * - Multi-segment lessons with audio narration and visual content
 * - Play/pause controls with progress tracking
 * - Navigation between segments
 * - Intro screen to prevent auto-play
 * - Automatic playback on segment change (after started)
 * - Beautiful UI with ambient effects
 * - Uses Web Audio API for PCM audio playback
 */
const MediaPlayer: React.FC<MediaPlayerProps> = ({ data, className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  const currentSegment = data.segments[currentIndex];

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    startTimeRef.current = 0;
  };

  const playAudio = async () => {
    if (!audioBuffer) return;

    const audioContext = getAudioContext();

    // Resume audio context if suspended (required for autoplay policy)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Stop any existing playback
    stopAudio();

    // Create source node
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    // Track when playback started
    const offset = pausedAtRef.current;
    startTimeRef.current = audioContext.currentTime - offset;

    source.start(0, offset);
    sourceNodeRef.current = source;
    setIsPlaying(true);
    setIsFinished(false);

    // Handle when audio ends
    source.onended = () => {
      if (sourceNodeRef.current === source) {
        setIsPlaying(false);
        setProgress(100);
        setIsFinished(true);
        pausedAtRef.current = 0;
      }
    };

    // Progress tracking
    const updateProgress = () => {
      if (!audioBuffer || !sourceNodeRef.current) return;

      const duration = audioBuffer.duration;
      const currentTime = audioContext.currentTime - startTimeRef.current;

      if (currentTime >= duration) {
        setIsPlaying(false);
        setProgress(100);
        setIsFinished(true);
        pausedAtRef.current = 0;
      } else {
        setProgress((currentTime / duration) * 100);
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const handlePlayPause = () => {
    if (!audioBuffer) return;

    if (isPlaying) {
      // Pause
      const audioContext = getAudioContext();
      const currentTime = audioContext.currentTime - startTimeRef.current;
      pausedAtRef.current = currentTime;
      stopAudio();
    } else {
      // Play/Resume
      if (progress >= 100) {
        pausedAtRef.current = 0;
        setProgress(0);
        setIsFinished(false);
      }
      setHasStarted(true);
      playAudio();
    }
  };

  const handleNext = () => {
    stopAudio();
    setProgress(0);
    setIsFinished(false);
    pausedAtRef.current = 0;
    if (currentIndex < data.segments.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    stopAudio();
    setProgress(0);
    setIsFinished(false);
    pausedAtRef.current = 0;
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleReplay = () => {
    stopAudio();
    pausedAtRef.current = 0;
    setProgress(0);
    setIsFinished(false);
    playAudio();
  };

  // Load audio buffer when segment changes
  useEffect(() => {
    const loadAudio = async () => {
      if (!currentSegment.audioBase64) {
        setAudioBuffer(null);
        return;
      }

      setIsLoadingAudio(true);
      try {
        const buffer = await base64ToAudioBuffer(currentSegment.audioBase64);
        setAudioBuffer(buffer);
      } catch (error) {
        console.error('Error loading audio:', error);
        setAudioBuffer(null);
      } finally {
        setIsLoadingAudio(false);
      }
    };

    loadAudio();
  }, [currentSegment.audioBase64]);

  // Auto-play on segment change (after audio is loaded) - only if already started
  useEffect(() => {
    setProgress(0);
    setIsFinished(false);
    pausedAtRef.current = 0;

    if (audioBuffer && hasStarted) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        playAudio();
      }, 100);

      return () => {
        clearTimeout(timer);
        stopAudio();
      };
    }

    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, audioBuffer, hasStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`min-h-[600px] w-full bg-slate-950 flex items-center justify-center p-4 md:p-6 lg:p-8 font-sans relative overflow-hidden rounded-3xl ${className}`}>

      {/* Ambient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />

      {/* Intro Overlay */}
      {!hasStarted && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center rounded-3xl">
          <div className="text-center space-y-6 max-w-md px-6">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/20 mb-4">
              <Play className="h-10 w-10 text-indigo-400 fill-current ml-1" />
            </div>
            <h2 className="text-3xl font-bold text-white">
              {data.title || 'Interactive Lesson'}
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              {data.segments.length} segments with audio narration and visual illustrations
            </p>
            <button
              onClick={handlePlayPause}
              disabled={!audioBuffer || isLoadingAudio}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Play className="h-5 w-5 fill-current" />
              {isLoadingAudio ? 'Loading...' : 'Begin Lesson'}
            </button>
          </div>
        </div>
      )}

      {/* Main Card Container */}
      <div className="w-full max-w-6xl h-[700px] bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 flex flex-col lg:flex-row overflow-hidden relative z-10 transition-all">

        {/* LEFT: Visual Stage */}
        <div className="relative w-full lg:w-2/3 h-[45%] lg:h-full bg-slate-900 flex items-center justify-center p-6 group">
          {/* Subtle Grid Pattern Background */}
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

          {/* Vignette for depth */}
          <div className="absolute inset-0 bg-radial-at-c from-transparent to-slate-900/50 pointer-events-none" />

          {currentSegment.imageUrl ? (
            <img
              key={currentIndex}
              src={currentSegment.imageUrl}
              alt={currentSegment.imagePrompt}
              className="relative z-10 max-h-full max-w-full object-contain animate-fade-in shadow-2xl drop-shadow-2xl rounded-lg"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 z-10">
              <RefreshCw className="mb-4 h-10 w-10 animate-spin opacity-50" />
              <p className="font-medium tracking-wide">Rendering Visualization...</p>
            </div>
          )}

          {/* Visual Controls Overlay (Visible on hover) */}
          <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-slate-800/80 backdrop-blur-md rounded-full px-3 py-1 text-xs font-medium text-white/70 border border-white/10 shadow-lg">
              Gemini Visualization
            </div>
          </div>
        </div>

        {/* RIGHT: Control Hub */}
        <div className="w-full lg:w-1/3 h-[55%] lg:h-full bg-slate-950/50 border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col">

          {/* Progress Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
                {currentIndex + 1}
              </span>
              <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Step {currentIndex + 1} of {data.segments.length}
              </span>
            </div>
            {data.title && (
              <div className="text-xs text-slate-500 hidden md:block">
                {data.title}
              </div>
            )}
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4 leading-tight">
              {currentSegment.title}
            </h2>

            <div className="prose prose-invert prose-lg">
              <p className="text-slate-300 leading-relaxed">
                {currentSegment.script}
              </p>
            </div>
          </div>

          {/* Bottom Controls Area */}
          <div className="p-6 lg:p-8 bg-slate-900/50 border-t border-white/5 space-y-6">

            {/* Scrubbing Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />
                  {isLoadingAudio ? 'Loading Audio...' : 'Audio Playback'}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ease-linear ${isFinished ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Buttons Row */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={handlePlayPause}
                  disabled={!audioBuffer || isLoadingAudio}
                  className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all ring-1 ring-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={handleReplay}
                  disabled={!audioBuffer || isLoadingAudio}
                  className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all ring-1 ring-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Replay"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="h-12 w-12 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-500 disabled:opacity-30 hover:text-white transition-all disabled:cursor-not-allowed"
                  title="Previous"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentIndex >= data.segments.length - 1}
                  className={`h-12 px-6 flex items-center gap-2 rounded-xl font-semibold transition-all transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                    isFinished
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title="Next"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MediaPlayer;
