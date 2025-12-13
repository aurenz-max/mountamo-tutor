import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw, Home, ArrowRight, RotateCcw, Volume2 } from 'lucide-react';
import { FullLessonSegment } from '../types';
import { getAudioContext } from '../utils/audioUtils';

interface PlayerProps {
  segments: FullLessonSegment[];
  onReset: () => void;
}

const Player: React.FC<PlayerProps> = ({ segments, onReset }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  const currentSegment = segments[currentIndex];

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
      }
      audioSourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
  };

  const playAudio = async (offset = 0) => {
    if (!currentSegment.audioBuffer) return;

    const ctx = getAudioContext();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
    }

    const source = ctx.createBufferSource();
    source.buffer = currentSegment.audioBuffer;
    source.connect(ctx.destination);
    
    source.start(0, offset);
    audioSourceRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;
    setIsPlaying(true);
    setIsFinished(false);
    
    const updateProgress = () => {
      const now = ctx.currentTime;
      const elapsed = now - startTimeRef.current;
      const duration = currentSegment.audioBuffer?.duration || 1;
      
      if (elapsed >= duration) {
        setIsPlaying(false);
        setProgress(100);
        setIsFinished(true); 
      } else {
        setProgress((elapsed / duration) * 100);
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      const ctx = getAudioContext();
      pauseTimeRef.current = ctx.currentTime - startTimeRef.current;
      stopAudio(); 
    } else {
      if (progress >= 100) {
        setProgress(0);
        pauseTimeRef.current = 0;
        setIsFinished(false);
      }
      playAudio(pauseTimeRef.current);
    }
  };

  const handleNext = () => {
    stopAudio();
    pauseTimeRef.current = 0;
    setProgress(0);
    setIsFinished(false);
    if (currentIndex < segments.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    stopAudio();
    pauseTimeRef.current = 0;
    setProgress(0);
    setIsFinished(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    setProgress(0);
    setIsFinished(false);
    playAudio(0);
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]); 

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 md:p-6 lg:p-8 font-sans relative overflow-hidden">
      
      {/* Ambient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />

      {/* Main Card Container */}
      <div className="w-full max-w-6xl h-[85vh] lg:h-[700px] bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 flex flex-col lg:flex-row overflow-hidden relative z-10 transition-all">
        
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
                className="relative z-10 max-h-full max-w-full object-contain animate-fade-in shadow-2xl drop-shadow-2xl"
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
                        Step {currentIndex + 1} of {segments.length}
                    </span>
                </div>
                <button 
                  onClick={onReset}
                  className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-slate-300 transition-colors"
                  title="Return Home"
                >
                  <Home className="h-4 w-4" />
                </button>
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
                        <span>Audio Playback</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div 
                        className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
                        onClick={() => { /* Seek logic placeholder */ }}
                    >
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
                            className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all ring-1 ring-white/10"
                            title={isPlaying ? "Pause" : "Play"}
                        >
                            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                        </button>
                        <button 
                            onClick={() => { stopAudio(); playAudio(0); }}
                            className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all ring-1 ring-white/10"
                            title="Replay"
                        >
                            <RotateCcw className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex gap-2">
                         <button 
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className="h-12 w-12 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-500 disabled:opacity-30 hover:text-white transition-all"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        
                        {currentIndex < segments.length - 1 ? (
                            <button 
                                onClick={handleNext}
                                className={`h-12 px-6 flex items-center gap-2 rounded-xl font-semibold transition-all transform active:scale-95 ${
                                    isFinished 
                                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' 
                                        : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                            >
                                Next <ArrowRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button 
                                onClick={onReset}
                                className="h-12 px-6 flex items-center gap-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all transform active:scale-95"
                            >
                                Finish <Home className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Player;