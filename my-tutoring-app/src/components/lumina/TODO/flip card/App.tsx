import React, { useState, useEffect, useCallback } from 'react';
import { generateFlashcards } from './services/geminiService';
import { Flashcard, GamePhase, GameStats } from './types';
import { FlashcardView } from './components/FlashcardView';
import { InputScreen } from './components/InputScreen';
import { Controls } from './components/Controls';
import { SummaryScreen } from './components/SummaryScreen';
import { LibraryModal } from './components/LibraryModal';
import { StackProgress } from './components/StackProgress';
import { AlertCircle, BookOpen } from 'lucide-react';

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>('input');
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [currentTopic, setCurrentTopic] = useState('');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [stats, setStats] = useState<GameStats>({ correct: 0, incorrect: 0, remaining: 0, streak: 0 });
  const [results, setResults] = useState<(boolean | null)[]>([]); // Track history for visual stack
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Library State
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Audio context for sound effects
  const [audioContext] = useState<AudioContext | null>(() => {
    try {
        return new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
        return null;
    }
  });

  const playTone = useCallback((type: 'success' | 'miss') => {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    if (type === 'success') {
        osc.frequency.setValueAtTime(600, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    } else {
        osc.frequency.setValueAtTime(300, audioContext.currentTime);
        osc.frequency.linearRampToValueAtTime(200, audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    }

    osc.start();
    osc.stop(audioContext.currentTime + 0.2);
  }, [audioContext]);

  const handleStart = async (topic: string) => {
    setPhase('loading');
    setErrorMsg(null);
    setCurrentTopic(topic);
    try {
      const cards = await generateFlashcards(topic);
      setDeck(cards);
      setCurrentCardIndex(0);
      setResults(new Array(cards.length).fill(null));
      setStats({ correct: 0, incorrect: 0, remaining: cards.length, streak: 0 });
      setPhase('playing');
    } catch (err) {
      setErrorMsg("Failed to generate deck. Please check your API key and try again.");
      setPhase('input');
    }
  };

  const handleShuffle = () => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDeck(shuffled);
    setCurrentCardIndex(0);
    setResults(new Array(shuffled.length).fill(null));
    setStats({ correct: 0, incorrect: 0, remaining: shuffled.length, streak: 0 });
    setIsFlipped(false);
    setIsLibraryOpen(false); 
    setPhase('playing');
  };

  const handleFlip = () => {
    if (phase === 'playing') {
      setIsFlipped(!isFlipped);
    }
  };

  const handleNextCard = useCallback((known: boolean) => {
    if (phase !== 'playing') return;

    // Visual feedback
    setDirection(known ? 'right' : 'left');
    playTone(known ? 'success' : 'miss');

    // Update Result History immediately for faster UI feedback if needed, 
    // but doing it in timeout syncs with card slide
    setTimeout(() => {
        setStats(prev => ({
            correct: known ? prev.correct + 1 : prev.correct,
            incorrect: !known ? prev.incorrect + 1 : prev.incorrect,
            remaining: prev.remaining - 1,
            streak: known ? prev.streak + 1 : 0
        }));

        setResults(prev => {
            const newResults = [...prev];
            newResults[currentCardIndex] = known;
            return newResults;
        });

        setDirection(null);
        setIsFlipped(false);
        
        const nextIndex = currentCardIndex + 1;
        if (nextIndex < deck.length) {
            setCurrentCardIndex(nextIndex);
        } else {
            setPhase('summary');
        }
    }, 300); // Wait for slide animation
  }, [currentCardIndex, deck.length, phase, playTone]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (phase !== 'playing' || isLibraryOpen) return;
        if (e.code === 'Space') {
            e.preventDefault();
            if (!direction) {
                setIsFlipped(prev => !prev);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, direction, isLibraryOpen]);

  return (
    <div className="min-h-screen font-sans selection:bg-indigo-500/30 overflow-hidden">
        
        {/* Header/Nav */}
        <div className="fixed top-0 w-full p-6 flex justify-between items-center z-40 pointer-events-none">
            <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 pointer-events-auto drop-shadow-sm flex items-center gap-2">
                FlashBurst
            </div>

            <div className="flex gap-4 pointer-events-auto">
                {phase === 'playing' && (
                    <button 
                      onClick={() => setIsLibraryOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 transition-all text-sm font-medium text-white shadow-lg hover:shadow-indigo-500/20"
                    >
                      <BookOpen size={16} />
                      <span className="hidden sm:inline">Library</span>
                    </button>
                )}
            </div>
        </div>

        {/* Library Modal */}
        <LibraryModal 
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          onShuffle={handleShuffle}
          deck={deck}
          topic={currentTopic}
        />

        {/* Main Content Area */}
        <main className={`container mx-auto min-h-screen flex flex-col items-center justify-center p-4 transition-all duration-300 ${isLibraryOpen ? 'blur-sm scale-95 opacity-50' : ''}`}>
            
            {errorMsg && (
                <div className="absolute top-24 bg-red-500/10 border border-red-500/50 backdrop-blur text-red-100 px-6 py-4 rounded-xl flex items-center gap-3 animate-slide-in shadow-xl">
                    <AlertCircle size={20} />
                    {errorMsg}
                </div>
            )}

            {phase === 'input' && (
                <InputScreen onStart={handleStart} isLoading={false} />
            )}
            
            {phase === 'loading' && (
                <InputScreen onStart={() => {}} isLoading={true} />
            )}

            {phase === 'playing' && deck.length > 0 && (
                <div className="flex flex-col items-center w-full max-w-md gap-6">
                    
                    <FlashcardView 
                        card={deck[currentCardIndex]} 
                        isFlipped={isFlipped}
                        onFlip={handleFlip}
                        direction={direction}
                    />

                    <Controls 
                        onKnow={() => handleNextCard(true)}
                        onDontKnow={() => handleNextCard(false)}
                        isFlipped={isFlipped}
                        disabled={direction !== null}
                    />

                    <StackProgress 
                        total={deck.length} 
                        current={currentCardIndex} 
                        results={results} 
                    />
                </div>
            )}

            {phase === 'summary' && (
                <SummaryScreen 
                    stats={stats}
                    onRestart={handleShuffle}
                    onNewTopic={() => {
                        setPhase('input');
                        setDeck([]);
                        setCurrentTopic('');
                    }}
                />
            )}
        </main>
    </div>
  );
};

export default App;