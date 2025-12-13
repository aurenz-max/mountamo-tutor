import React, { useState } from 'react';
import { Sparkles, PlayCircle, Settings2 } from 'lucide-react';
import { ImageResolution } from '../types';

interface TopicFormProps {
  onSubmit: (topic: string, resolution: ImageResolution) => void;
  isGenerating: boolean;
}

const TopicForm: React.FC<TopicFormProps> = ({ onSubmit, isGenerating }) => {
  const [topic, setTopic] = useState('');
  const [resolution, setResolution] = useState<ImageResolution>('1K');
  const [showSettings, setShowSettings] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onSubmit(topic, resolution);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-4">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-500/10 px-4 py-1.5 ring-1 ring-indigo-500/30">
            <Sparkles className="mr-2 h-4 w-4 text-indigo-400" />
            <span className="text-sm font-medium text-indigo-300">Powered by Gemini 2.5 & 3.0</span>
          </div>
          <h1 className="bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
            Concept Viz
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Turn any topic into an immersive audio-visual experience.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative z-10">
          <div className="group relative overflow-hidden rounded-2xl bg-slate-800/50 p-1 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all hover:bg-slate-800/80 hover:ring-indigo-500/50">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What do you want to learn about? (e.g., Snell's Law)"
                disabled={isGenerating}
                className="flex-1 bg-transparent px-6 py-4 text-lg text-white placeholder-slate-500 outline-none transition-colors"
                autoFocus
              />
              <button
                type="submit"
                disabled={!topic.trim() || isGenerating}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-4 font-bold text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Visualize <PlayCircle className="h-5 w-5" />
                  </span>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Settings2 className="h-4 w-4" />
              {showSettings ? 'Hide Settings' : 'Image Settings'}
            </button>
          </div>

          {showSettings && (
             <div className="mt-4 rounded-xl bg-slate-800/40 p-4 ring-1 ring-white/5 backdrop-blur-sm animate-fade-in-down">
                <label className="mb-2 block text-sm font-medium text-slate-300">Image Resolution (Gemini 3 Pro)</label>
                <div className="flex gap-2">
                  {(['1K', '2K', '4K'] as ImageResolution[]).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                        resolution === res
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                          : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
             </div>
          )}
        </form>

        {/* Decorative background elements */}
        <div className="absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 blur-[100px]" />
        <div className="absolute left-1/2 top-1/3 -z-10 h-[300px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-[80px]" />
      </div>
    </div>
  );
};

export default TopicForm;