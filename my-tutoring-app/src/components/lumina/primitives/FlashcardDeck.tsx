import React, { useState, useCallback, useEffect } from 'react';
import { FlashcardDeckData, FlashcardItem } from '../types';
import { Check, X, BookOpen, Shuffle, AlertCircle } from 'lucide-react';

interface FlashcardDeckProps {
  data: FlashcardDeckData;
  className?: string;
}

type GamePhase = 'ready' | 'playing' | 'summary';

interface GameStats {
  correct: number;
  incorrect: number;
  remaining: number;
  streak: number;
}

const FlashcardDeck: React.FC<FlashcardDeckProps> = ({ data, className }) => {
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [deck, setDeck] = useState<FlashcardItem[]>(data.cards);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [stats, setStats] = useState<GameStats>({ correct: 0, incorrect: 0, remaining: 0, streak: 0 });
  const [results, setResults] = useState<(boolean | null)[]>([]);

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

  const handleStart = () => {
    setCurrentCardIndex(0);
    setResults(new Array(deck.length).fill(null));
    setStats({ correct: 0, incorrect: 0, remaining: deck.length, streak: 0 });
    setIsFlipped(false);
    setPhase('playing');
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
    setPhase('playing');
  };

  const handleFlip = () => {
    if (phase === 'playing') {
      setIsFlipped(!isFlipped);
    }
  };

  const handleNextCard = useCallback((known: boolean) => {
    if (phase !== 'playing') return;

    setDirection(known ? 'right' : 'left');
    playTone(known ? 'success' : 'miss');

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
    }, 300);
  }, [currentCardIndex, deck.length, phase, playTone]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'playing') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!direction) {
          setIsFlipped(prev => !prev);
        }
      } else if (isFlipped && !direction) {
        if (e.key === 'ArrowLeft') {
          handleNextCard(false);
        } else if (e.key === 'ArrowRight') {
          handleNextCard(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, direction, isFlipped, handleNextCard]);

  const currentCard = deck[currentCardIndex];

  // Ready Screen
  if (phase === 'ready') {
    return (
      <div className={`w-full max-w-2xl mx-auto px-6 py-12 ${className || ''}`}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 p-4 bg-indigo-500/10 rounded-full text-indigo-400 border border-indigo-500/30">
            <BookOpen size={48} />
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {data.title || 'Flashcard Deck'}
          </h2>

          {data.description && (
            <p className="text-slate-400 text-lg mb-8 max-w-md">
              {data.description}
            </p>
          )}

          <div className="mb-8 text-slate-300">
            <p className="text-sm mb-2">
              <span className="font-bold text-2xl text-white">{deck.length}</span> cards ready to study
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-500/20"
            >
              Start Studying
            </button>
            <button
              onClick={handleShuffle}
              className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-lg transition-all flex items-center gap-2"
            >
              <Shuffle size={20} />
              Shuffle
            </button>
          </div>

          <p className="mt-8 text-slate-500 text-sm">
            Use <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600">Space</kbd> to flip,{' '}
            <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600">←</kbd> if you don't know,{' '}
            <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600">→</kbd> if you know
          </p>
        </div>
      </div>
    );
  }

  // Playing Phase
  if (phase === 'playing' && currentCard) {
    let animationClass = 'animate-slide-in';
    if (direction === 'left') animationClass = 'animate-slide-out-left';
    if (direction === 'right') animationClass = 'animate-slide-out-right';

    return (
      <div className={`w-full max-w-2xl mx-auto px-6 py-8 ${className || ''}`}>
        <div className="flex flex-col items-center gap-6">
          {/* Flashcard */}
          <div
            className={`relative w-full max-w-md h-80 cursor-pointer perspective-1000 group ${animationClass}`}
            onClick={handleFlip}
            style={{ perspective: '1000px' }}
          >
            <div
              className={`relative w-full h-full duration-500 transition-all`}
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              {/* Front */}
              <div
                className="absolute w-full h-full rounded-2xl p-8 flex flex-col items-center justify-center bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] text-white group-hover:border-white/30 group-hover:shadow-[0_8px_32px_0_rgba(99,102,241,0.2)] transition-all"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <span className="absolute top-4 right-4 text-xs font-bold tracking-wider text-indigo-200/70 uppercase border border-indigo-200/20 px-2 py-1 rounded-full">
                  {currentCard.category}
                </span>

                <h2 className="text-3xl font-bold text-center leading-tight select-none drop-shadow-md">
                  {currentCard.term}
                </h2>

                <p className="absolute bottom-6 text-indigo-200/60 text-sm font-medium animate-pulse">
                  Click to Reveal
                </p>
              </div>

              {/* Back */}
              <div
                className="absolute w-full h-full rounded-2xl p-8 flex flex-col items-center justify-center bg-indigo-950 border border-indigo-400/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] text-white"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                <h3 className="text-xl text-indigo-300 font-semibold mb-3 uppercase tracking-wide text-xs">
                  Answer
                </h3>

                <p className="text-2xl font-medium text-center leading-snug select-none drop-shadow-sm">
                  {currentCard.definition}
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          {!isFlipped ? (
            <div className="h-24 flex items-center justify-center text-slate-400 text-sm">
              Flip the card to reveal options
            </div>
          ) : (
            <div className="flex gap-6 h-24 items-center justify-center animate-slide-in">
              <button
                onClick={() => handleNextCard(false)}
                disabled={direction !== null}
                className="flex flex-col items-center gap-2 group focus:outline-none"
                aria-label="I don't know this yet"
              >
                <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500 text-red-500 flex items-center justify-center transition-all duration-200 group-hover:bg-red-500 group-hover:text-white group-active:scale-95">
                  <X size={32} />
                </div>
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider group-hover:text-red-300">Study Again</span>
                <span className="text-[10px] text-slate-500 hidden md:block">Left Arrow</span>
              </button>

              <div className="w-px h-12 bg-slate-700/50"></div>

              <button
                onClick={() => handleNextCard(true)}
                disabled={direction !== null}
                className="flex flex-col items-center gap-2 group focus:outline-none"
                aria-label="I know this"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-500 flex items-center justify-center transition-all duration-200 group-hover:bg-emerald-500 group-hover:text-white group-active:scale-95">
                  <Check size={32} />
                </div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider group-hover:text-emerald-300">Got It</span>
                <span className="text-[10px] text-slate-500 hidden md:block">Right Arrow</span>
              </button>
            </div>
          )}

          {/* Progress */}
          <div className="flex flex-col items-center gap-2 mt-4">
            <div className="flex items-center gap-1.5 p-2 rounded-full bg-slate-900/40 backdrop-blur-md border border-white/5">
              {Array.from({ length: deck.length }).map((_, i) => {
                const isPast = i < currentCardIndex;
                const isCurrent = i === currentCardIndex;
                const result = results[i];

                let statusClasses = 'w-2 bg-slate-700/50';

                if (isCurrent) {
                  statusClasses = 'w-8 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]';
                } else if (isPast) {
                  if (result === true) {
                    statusClasses = 'w-2 bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.4)]';
                  } else if (result === false) {
                    statusClasses = 'w-2 bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.4)]';
                  } else {
                    statusClasses = 'w-2 bg-slate-500';
                  }
                }

                return (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-500 ease-out ${statusClasses}`}
                  />
                );
              })}
            </div>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
              {currentCardIndex + 1} / {deck.length}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Summary Screen
  if (phase === 'summary') {
    const total = stats.correct + stats.incorrect;
    const percentage = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

    return (
      <div className={`w-full max-w-lg mx-auto px-6 py-12 ${className || ''}`}>
        <div className="flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold text-white mb-8">Session Complete!</h2>

          <div className="grid grid-cols-2 gap-4 w-full mb-8">
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col items-center">
              <AlertCircle className="text-yellow-400 mb-2" size={32} />
              <span className="text-3xl font-bold text-white">{percentage}%</span>
              <span className="text-slate-400 text-sm">Accuracy</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col items-center">
              <Check className="text-emerald-400 mb-2" size={32} />
              <span className="text-3xl font-bold text-white">{stats.correct}/{total}</span>
              <span className="text-slate-400 text-sm">Correct Cards</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleShuffle}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              <Shuffle size={20} />
              Shuffle & Review Again
            </button>
            <button
              onClick={() => setPhase('ready')}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold text-lg transition-all border border-slate-700"
            >
              Back to Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default FlashcardDeck;
