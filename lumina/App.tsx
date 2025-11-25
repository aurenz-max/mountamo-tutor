
import React, { useState, useCallback } from 'react';
import { GenerativeBackground } from './components/GenerativeBackground';
import { ConceptCard } from './components/SpellingCard'; 
import { CuratorBrief } from './components/CuratorBrief';
import { GenerativeTable } from './components/GenerativeTable';
import { KnowledgeCheck } from './components/KnowledgeCheck';
import { FeatureExhibit } from './components/FeatureExhibit';
import { ComparisonPanel } from './components/ComparisonPanel';
import { ModuleResolver } from './components/ModuleResolver'; // Replaces FormulaCard
import { DetailDrawer } from './components/DetailDrawer'; 
import { generateExhibitContent } from './services/geminiService';
import { GameState, ExhibitData } from './types';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [topic, setTopic] = useState('');
  const [exhibitData, setExhibitData] = useState<ExhibitData | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<string | null>(null);

  const startExhibit = useCallback(async (topicOverride?: string) => {
    const searchTopic = topicOverride || topic;
    if (!searchTopic.trim()) return;

    if (topicOverride) setTopic(topicOverride);

    setGameState(GameState.GENERATING);
    setLoadingMessage(`Curating exhibit: ${searchTopic.substring(0, 30)}...`);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    try {
      setTimeout(() => setLoadingMessage('Gathering historical context...'), 1500);
      setTimeout(() => setLoadingMessage('Synthesizing key concepts...'), 3000);
      setTimeout(() => setLoadingMessage('Designing interactive visuals...'), 4500);

      const data = await generateExhibitContent(searchTopic);
      setExhibitData(data);
      setGameState(GameState.PLAYING);
    } catch (error) {
      console.error(error);
      setGameState(GameState.ERROR);
      alert("Failed to generate exhibit. Please try a different topic or check API key.");
      setGameState(GameState.IDLE);
    }
  }, [topic]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startExhibit();
  };

  const reset = () => {
    setGameState(GameState.IDLE);
    setTopic('');
    setExhibitData(null);
  };

  const handleDetailItemClick = (item: string) => {
      setSelectedDetailItem(item);
      setIsDrawerOpen(true);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden selection:bg-blue-500/30">
      
      {/* Detail Drawer for Table Items & Feature Terms */}
      <DetailDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        contextTopic={exhibitData?.topic || ''}
        itemName={selectedDetailItem}
      />

      {/* Dynamic Background */}
      <GenerativeBackground 
        color={exhibitData?.cards[0]?.themeColor || '#475569'} 
        intensity={0.3}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 w-full px-6 py-4 z-50 flex justify-between items-center bg-slate-900/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
             <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="font-bold text-white text-lg">L</span>
             </div>
             <span className="text-xl font-bold tracking-tight text-white">Lumina <span className="text-slate-500 font-light">Exhibits</span></span>
        </div>
        <div className="flex gap-4 text-xs md:text-sm font-mono text-slate-400">
            {gameState === GameState.PLAYING && (
                <button onClick={reset} className="hover:text-white transition-colors">
                   ← New Topic
                </button>
            )}
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 min-h-screen flex flex-col pt-24 pb-12">
        
        {/* IDLE STATE */}
        {gameState === GameState.IDLE && (
          <div className="flex-1 flex flex-col justify-center items-center text-center animate-fade-in">
             <div className="space-y-6 max-w-2xl">
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-slate-500">
                    What will you learn?
                </h1>
                <p className="text-slate-400 text-xl md:text-2xl font-light leading-relaxed">
                    Enter any topic to generate an interactive museum exhibit.
                </p>

                <form onSubmit={handleFormSubmit} className="relative group max-w-lg mx-auto mt-12">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Quantum Mechanics, The Roman Empire, Jazz..."
                            className="w-full px-8 py-5 bg-slate-900 text-white rounded-full border border-slate-700 focus:border-blue-400/50 focus:outline-none text-lg shadow-2xl transition-all"
                            autoFocus
                        />
                        <button 
                            type="submit"
                            className="absolute right-2 p-3 bg-white text-slate-900 rounded-full hover:bg-blue-50 transition-transform active:scale-95 disabled:opacity-50"
                            disabled={!topic}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                </form>

                <div className="pt-12 grid grid-cols-2 md:flex justify-center gap-3">
                    {['Industrial Revolution', 'Botany', 'Cubism', 'Black Holes'].map(suggestion => (
                        <button 
                            key={suggestion}
                            onClick={() => { setTopic(suggestion); startExhibit(suggestion); }} 
                            className="px-5 py-2 rounded-full border border-white/10 hover:bg-white/5 text-sm text-slate-400 transition-colors hover:text-white"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
             </div>
          </div>
        )}

        {/* GENERATING STATE */}
        {gameState === GameState.GENERATING && (
            <div className="flex-1 flex flex-col justify-center items-center text-center">
                <div className="relative w-32 h-32 mb-8">
                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                    <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin shadow-[0_0_30px_rgba(59,130,246,0.5)]"></div>
                    <div className="absolute inset-4 border-t-4 border-purple-500 rounded-full animate-spin direction-reverse shadow-[0_0_30px_rgba(168,85,247,0.5)]" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
                </div>
                <h3 className="text-2xl font-bold text-white animate-pulse">{loadingMessage}</h3>
                <p className="text-slate-500 mt-2 font-mono text-sm">Generative AI is curating...</p>
            </div>
        )}

        {/* EXHIBIT STATE */}
        {gameState === GameState.PLAYING && exhibitData && (
            <div className="w-full animate-fade-in-up">
                {/* Title Section */}
                <div className="mb-12 text-center space-y-4">
                    <h2 className="text-5xl font-bold text-white tracking-tight">{exhibitData.topic}</h2>
                    <div className="max-w-4xl mx-auto">
                        <CuratorBrief data={exhibitData.intro} />
                    </div>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 justify-items-center max-w-7xl mx-auto mb-20">
                    {exhibitData.cards.map((card, index) => (
                        <div key={index} className="w-full flex justify-center" style={{ animationDelay: `${index * 150}ms` }}>
                            <ConceptCard data={card} index={index} />
                        </div>
                    ))}
                </div>

                {/* Polymorphic Specialized Module (Equation or Sentence) */}
                {exhibitData.modularExhibit && (
                    <ModuleResolver data={exhibitData.modularExhibit} />
                )}

                {/* Feature Exhibit (Deep Dive) */}
                {exhibitData.featureExhibit && (
                    <FeatureExhibit 
                        data={exhibitData.featureExhibit} 
                        onTermClick={handleDetailItemClick}
                    />
                )}
                
                {/* Comparison Panel */}
                {exhibitData.comparison && (
                    <ComparisonPanel data={exhibitData.comparison} />
                )}

                {/* Data Tables Section */}
                {exhibitData.tables && exhibitData.tables.length > 0 && (
                   <div className="max-w-5xl mx-auto mb-20">
                        <div className="flex items-center gap-4 mb-8">
                            <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">Data Analysis</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                        </div>
                        {exhibitData.tables.map((table, index) => (
                            <GenerativeTable 
                                key={index} 
                                data={table} 
                                index={index} 
                                onRowClick={handleDetailItemClick}
                            />
                        ))}
                   </div>
                )}

                {/* Knowledge Check Section */}
                {exhibitData.knowledgeCheck && (
                    <div className="max-w-4xl mx-auto mb-20">
                         <div className="flex items-center gap-4 mb-8">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                            <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">Knowledge Assessment</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                        </div>
                        <KnowledgeCheck data={exhibitData.knowledgeCheck} />
                    </div>
                )}

                {/* Related Topics */}
                {exhibitData.relatedTopics && exhibitData.relatedTopics.length > 0 && (
                    <div className="mt-24 mb-12 max-w-5xl mx-auto">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                            <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">Related Exhibits</span>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {exhibitData.relatedTopics.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => startExhibit(item.topic)}
                                    className="group relative p-6 flex flex-col h-full rounded-2xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-white/5 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-2 overflow-hidden text-left"
                                >
                                    <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors duration-500"></div>
                                    <div className="relative z-10 flex-1">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                                                {item.category}
                                            </span>
                                            <span className="text-xs text-slate-600 font-mono group-hover:text-blue-400 transition-colors">0{i + 1}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-200 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            {item.teaser}
                                        </p>
                                    </div>
                                    <div className="relative z-10 mt-4 flex items-center text-xs font-bold text-blue-500/70 uppercase tracking-wider group-hover:text-blue-400 transition-colors">
                                        <span>Enter Portal</span>
                                        <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

      </main>
    </div>
  );
}
