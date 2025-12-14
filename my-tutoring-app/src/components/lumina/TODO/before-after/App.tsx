import React, { useState } from 'react';
import { Sparkles, Wand2, RefreshCw, BookOpen, Lightbulb } from 'lucide-react';
import { GlassCard } from './components/GlassCard';
import { ImageComparison } from './components/ImageComparison';
import { generateBeforeAfterImages } from './services/geminiService';
import { GeneratedImages, GenerationState } from './types';

function App() {
  const [topic, setTopic] = useState('');
  const [images, setImages] = useState<GeneratedImages>({ before: null, after: null });
  const [status, setStatus] = useState<GenerationState>({ isLoading: false, error: null });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || status.isLoading) return;

    setStatus({ isLoading: true, error: null, step: 'analyzing' });
    setImages({ before: null, after: null }); // Reset previous images
    
    try {
      const result = await generateBeforeAfterImages(topic, (currentStep) => {
        setStatus(prev => ({ ...prev, step: currentStep }));
      });
      setImages(result);
    } catch (err: any) {
      setStatus({ 
        isLoading: false, 
        error: "Failed to generate images. Please try again. " + (err.message || "") 
      });
    } finally {
      setStatus(prev => ({ ...prev, isLoading: false, step: undefined }));
    }
  };

  const getLoadingText = () => {
    switch(status.step) {
      case 'analyzing': return "Analyzing concept...";
      case 'generating_before': return "Creating initial state...";
      case 'generating_after': return "Evolving to final state...";
      default: return "Dreaming...";
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden text-white selection:bg-purple-500/30">
      {/* Modern Gradient Background */}
      <div className="fixed inset-0 bg-slate-950 z-[-2]"></div>
      <div className="fixed inset-0 z-[-1] opacity-50">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <main className="container mx-auto px-4 py-12 max-w-4xl flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-4 shadow-lg">
            <Sparkles size={14} className="text-yellow-300" />
            <span className="text-xs font-semibold tracking-wider uppercase text-white/80">Powered by Gemini 2.5</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 tracking-tight">
            TimeShift
          </h1>
          <p className="text-lg text-white/60 max-w-lg mx-auto leading-relaxed">
            Educational visualizations. Enter a concept to see a logical "Before & After" progression.
          </p>
        </div>

        {/* Input Section */}
        <GlassCard className="w-full p-2 group focus-within:ring-2 focus-within:ring-purple-500/50 transition-all duration-300">
          <form onSubmit={handleGenerate} className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Snell's Law, Mitochondria, The Roman Empire..."
                className="w-full h-14 bg-transparent border-none outline-none px-4 text-lg placeholder:text-white/20 text-white font-light"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:block text-xs text-white/30 border border-white/10 px-2 py-1 rounded">
                ENTER
              </div>
            </div>
            <button
              type="submit"
              disabled={status.isLoading || !topic.trim()}
              className="h-14 px-8 rounded-xl bg-white text-slate-900 font-bold text-lg hover:bg-white/90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
            >
              {status.isLoading ? (
                <>
                  <RefreshCw className="animate-spin" />
                  <span className="min-w-[8rem]">{getLoadingText()}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </form>
        </GlassCard>

        {/* Error Message */}
        {status.error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl backdrop-blur-md text-sm text-center animate-in fade-in slide-in-from-top-2">
            {status.error}
          </div>
        )}

        {/* Comparison Viewer */}
        <div className="w-full">
          <ImageComparison 
            beforeImage={images.before || ''} 
            afterImage={images.after || ''} 
            beforeLabel={images.beforeLabel}
            afterLabel={images.afterLabel}
            isLoading={status.isLoading}
          />
        </div>

        {/* Detailed Educational Info */}
        {images.before && (
           <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              
              {/* Detailed Description Card */}
              <GlassCard className="p-6 md:p-8 border-l-4 border-l-blue-400">
                <div className="flex items-start gap-4">
                  <BookOpen className="w-6 h-6 text-blue-300 shrink-0 mt-1" />
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-white">The Science Behind It</h3>
                    <p className="text-white/80 leading-relaxed text-base md:text-lg">
                      {images.detailedExplanation || images.description}
                    </p>
                  </div>
                </div>
              </GlassCard>

              {/* Key Takeaways Grid */}
              {images.keyTakeaways && images.keyTakeaways.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {images.keyTakeaways.map((point, index) => (
                    <GlassCard key={index} className="p-5">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-purple-300">
                          <Lightbulb size={16} />
                          <span className="text-xs font-bold uppercase tracking-wider">Key Point {index + 1}</span>
                        </div>
                        <p className="text-white/90 font-medium leading-snug">{point}</p>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
           </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-white/20 text-sm">
          <p>© {new Date().getFullYear()} TimeShift AI. Images generated by Gemini.</p>
        </footer>
      </main>

      {/* Global Styles for Animations */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite linear;
        }
      `}</style>
    </div>
  );
}

export default App;
