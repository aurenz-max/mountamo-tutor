import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SpotlightCard } from './SpotlightCard';
import type { GradeLevel } from './GradeLevelSelector';

interface TopicSuggestion {
  topic: string;
  emoji: string;
  hook: string;
  category: 'investigate' | 'connect' | 'wonder';
}

interface TopicExplorerProps {
  gradeLevel: GradeLevel;
  onSelectTopic: (topic: string) => void;
}

const CATEGORY_META: Record<TopicSuggestion['category'], { label: string; color: string }> = {
  investigate: { label: 'Investigate',      color: '250, 204, 21'  },
  connect:     { label: 'Connect',          color: '56, 189, 248'  },
  wonder:      { label: 'Wonder',           color: '192, 132, 252' },
};

// Fallback topics shown instantly while Gemini loads
const SEED_TOPICS: TopicSuggestion[] = [
  { topic: 'Build a Bridge That Holds 100 Coins',   emoji: '🌉', hook: 'Paper can be stronger than you think',  category: 'investigate' },
  { topic: 'What Shape Egg Is Strongest?',           emoji: '🥚', hook: 'Squeeze one — you might be surprised', category: 'investigate' },
  { topic: 'Design a Paper Airplane That Curves',    emoji: '✈️', hook: 'Fold one wing different and measure',   category: 'investigate' },
  { topic: 'Why Does Your Voice Sound Weird on Video?', emoji: '🎤', hook: 'Your skull changes the sound you hear', category: 'connect' },
  { topic: 'How Does Your Phone Know Which Way Is Up?', emoji: '📱', hook: 'Tiny springs inside measure gravity', category: 'connect' },
  { topic: 'Could You Outrun a Dinosaur?',           emoji: '🦖', hook: 'Estimate their speed from leg bones',  category: 'wonder' },
  { topic: 'What If the Moon Disappeared Tonight?',  emoji: '🌙', hook: 'Tides, seasons, and days would change', category: 'wonder' },
  { topic: 'Is a Hot Dog a Sandwich?',               emoji: '🌭', hook: 'Define "sandwich" — then argue it',     category: 'wonder' },
];

export const TopicExplorer: React.FC<TopicExplorerProps> = ({
  gradeLevel,
  onSelectTopic,
}) => {
  const [topics, setTopics] = useState<TopicSuggestion[]>(SEED_TOPICS);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const previousTopicsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTopics = useCallback(async (isRefresh = false) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateTopicSuggestions',
          params: {
            gradeLevel,
            count: 8,
            previousTopics: previousTopicsRef.current,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Failed to fetch topics');
      const data: TopicSuggestion[] = await res.json();

      // Track shown topics to avoid repeats on refresh
      previousTopicsRef.current = [
        ...previousTopicsRef.current,
        ...data.map(t => t.topic),
      ].slice(-24); // keep last 24

      setTopics(data);
      setHasLoaded(true);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      // On error, keep current topics — don't blank the screen
      console.error('Topic suggestions failed:', err);
    } finally {
      setLoading(false);
    }
  }, [gradeLevel]);

  // Fetch on mount and when grade changes
  useEffect(() => {
    previousTopicsRef.current = [];
    fetchTopics();
    return () => abortRef.current?.abort();
  }, [fetchTopics]);

  // Group by category
  const grouped = topics.reduce<Record<string, TopicSuggestion[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700" />
        <span className="text-slate-500 text-xs font-mono uppercase tracking-widest">
          Explore Topics
        </span>
        <button
          onClick={() => fetchTopics(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                     bg-white/5 border border-white/10 text-slate-400
                     hover:bg-white/10 hover:text-slate-200 hover:border-white/20
                     disabled:opacity-40 transition-all"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {loading ? 'Loading...' : 'Surprise me'}
        </button>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700" />
      </div>

      {/* Category swim lanes */}
      {(['investigate', 'connect', 'wonder'] as const).map(cat => {
        const items = grouped[cat];
        if (!items?.length) return null;
        const meta = CATEGORY_META[cat];

        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: `rgb(${meta.color})` }}
              />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {meta.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {items.map((t) => (
                <SpotlightCard
                  key={t.topic}
                  color={meta.color}
                  onClick={() => onSelectTopic(t.topic)}
                  className={`bg-slate-900/40 ${loading && !hasLoaded ? 'animate-pulse' : ''}`}
                >
                  <div className="p-4 flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-200 transition-colors leading-snug">
                        {t.topic}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {t.hook}
                      </p>
                    </div>
                    <svg
                      className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-all group-hover:translate-x-0.5 flex-shrink-0 mt-1"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
