import React, { useState } from 'react';
import TopicForm from './components/TopicForm';
import Player from './components/Player';
import ApiKeyChecker from './components/ApiKeyChecker';
import { generateLessonPlan, generateAudioSegment, generateImageSegment } from './services/geminiService';
import { AppState, FullLessonSegment, ImageResolution, LessonSegment } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [segments, setSegments] = useState<FullLessonSegment[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [apiKeySelected, setApiKeySelected] = useState(false);

  // We only start the main UI once API key is confirmed
  if (!apiKeySelected) {
    return <ApiKeyChecker onKeySelected={() => setApiKeySelected(true)} />;
  }

  const handleGenerate = async (topic: string, resolution: ImageResolution) => {
    try {
      setAppState(AppState.GENERATING_PLAN);
      setLoadingMessage('Consulting the AI knowledge base...');
      
      // 1. Generate the plan
      const lessonPlan = await generateLessonPlan(topic);
      
      setAppState(AppState.GENERATING_ASSETS);
      
      // 2. Generate assets for all segments
      // To provide a faster "start", we could generate the first one then stream the rest,
      // but for stability and simplicity of this demo, we'll generate all.
      // We can run them in parallel for speed.
      
      const fullSegments: FullLessonSegment[] = [];
      const totalOps = lessonPlan.length * 2; // Audio + Image per segment
      let completedOps = 0;

      const updateProgress = () => {
        completedOps++;
        const percent = Math.round((completedOps / totalOps) * 100);
        setLoadingMessage(`Creating immersive assets... ${percent}%`);
      };

      // Process segments concurrently
      const promises = lessonPlan.map(async (segment: LessonSegment, index: number) => {
        // Parallel audio and image generation for this segment
        const [audioBuffer, imageUrl] = await Promise.all([
           generateAudioSegment(segment.script)
             .then(res => { updateProgress(); return res; })
             .catch(e => { console.error("Audio gen failed", e); return null; }),
           generateImageSegment(segment.imagePrompt, resolution)
             .then(res => { updateProgress(); return res; })
             .catch(e => { console.error("Image gen failed", e); return null; })
        ]);

        return {
          ...segment,
          audioBuffer,
          imageUrl
        };
      });

      const results = await Promise.all(promises);
      
      // Filter out any completely failed segments if necessary, 
      // but we'll try to show what we have even if partial.
      setSegments(results);
      setAppState(AppState.READY);
    } catch (error) {
      console.error(error);
      setAppState(AppState.ERROR);
      setLoadingMessage('Something went wrong. Please try a different topic.');
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setSegments([]);
  };

  if (appState === AppState.IDLE) {
    return <TopicForm onSubmit={handleGenerate} isGenerating={false} />;
  }

  if (appState === AppState.GENERATING_PLAN || appState === AppState.GENERATING_ASSETS) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white">
        <div className="relative mb-8">
           <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500 opacity-20"></div>
           <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 ring-1 ring-white/10">
             <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
           </div>
        </div>
        <h2 className="text-2xl font-bold animate-pulse">{loadingMessage}</h2>
        <p className="mt-2 text-slate-400">Powered by Gemini 2.5 Flash & 3.0 Pro</p>
      </div>
    );
  }

  if (appState === AppState.ERROR) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white p-4 text-center">
        <div className="mb-4 text-red-400">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold">Generation Failed</h2>
        <p className="mb-8 text-slate-400 max-w-md">{loadingMessage}</p>
        <button 
          onClick={handleReset}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  return <Player segments={segments} onReset={handleReset} />;
};

export default App;