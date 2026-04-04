'use client';

import React, { useRef, useEffect, useState } from 'react';

export type GradeLevel =
  | 'toddler'
  | 'preschool'
  | 'kindergarten'
  | 'elementary'
  | 'middle-school'
  | 'high-school'
  | 'undergraduate'
  | 'graduate'
  | 'phd';

interface GradeLevelOption {
  value: GradeLevel;
  label: string;
  shortLabel: string;
  description: string;
  emoji: string;
}

const gradeLevelOptions: GradeLevelOption[] = [
  { value: 'toddler',       label: 'Toddler',      shortLabel: '1–3',     description: 'Ages 1–3 · Sensory play, shapes & colors',          emoji: '👶' },
  { value: 'preschool',     label: 'Pre-K',         shortLabel: '3–5',     description: 'Ages 3–5 · Letters, counting & early patterns',     emoji: '🎨' },
  { value: 'kindergarten',  label: 'Kinder',        shortLabel: '5–6',     description: 'Ages 5–6 · Reading readiness & basic addition',     emoji: '🎒' },
  { value: 'elementary',    label: 'Elementary',     shortLabel: '1–5',     description: 'Grades 1–5 · Core math, science & reading',        emoji: '📚' },
  { value: 'middle-school', label: 'Middle',        shortLabel: '6–8',     description: 'Grades 6–8 · Pre-algebra, life science & writing',  emoji: '🔬' },
  { value: 'high-school',   label: 'High School',   shortLabel: '9–12',    description: 'Grades 9–12 · Algebra through calculus & AP prep',  emoji: '🎓' },
  { value: 'undergraduate', label: 'Undergrad',     shortLabel: 'College', description: 'College level · Intro courses & general education', emoji: '🏛️' },
  { value: 'graduate',      label: 'Graduate',      shortLabel: 'MS',      description: "Master's level · Advanced theory & research",       emoji: '📖' },
  { value: 'phd',           label: 'PhD',           shortLabel: 'PhD',     description: 'Doctoral level · Deep specialization & original research', emoji: '🎯' },
];

interface GradeLevelSelectorProps {
  value: GradeLevel;
  onChange: (level: GradeLevel) => void;
  className?: string;
}

export const GradeLevelSelector: React.FC<GradeLevelSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [displayedValue, setDisplayedValue] = useState(value);
  const [fading, setFading] = useState(false);

  const selected = gradeLevelOptions.find(o => o.value === displayedValue) ?? gradeLevelOptions[3];

  // Scroll selected chip into view
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const chip = selectedRef.current;
      const left = chip.offsetLeft - container.offsetWidth / 2 + chip.offsetWidth / 2;
      container.scrollTo({ left, behavior: 'smooth' });
    }
  }, [value]);

  // When value changes: fade out old text, swap, fade in new text
  useEffect(() => {
    if (value === displayedValue) return;
    setFading(true);
    const timer = setTimeout(() => {
      setDisplayedValue(value);
      setFading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [value, displayedValue]);

  const handleSelect = (level: GradeLevel) => {
    if (level === value) return;
    onChange(level);
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Chip strip */}
      <div
        ref={scrollRef}
        className="flex gap-1 sm:gap-1.5 overflow-x-auto w-full justify-center flex-wrap sm:flex-nowrap py-1 px-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {gradeLevelOptions.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`
                flex-shrink-0 flex items-center justify-center rounded-full font-medium
                transition-all duration-200 whitespace-nowrap border cursor-pointer
                px-2 py-1 text-[11px] gap-1
                sm:px-3 sm:py-1.5 sm:text-xs sm:gap-1.5
                ${isSelected
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-105'
                  : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10 hover:text-slate-200 hover:border-white/20'
                }
              `}
              title={opt.label}
            >
              <span className="text-xs sm:text-sm leading-none">{opt.emoji}</span>
              <span className="hidden xs:inline">{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Selected grade subtext */}
      <div
        className={`
          text-center transition-all duration-300 ease-out
          ${fading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}
        `}
      >
        <span className="text-sm sm:text-base font-medium text-slate-300">
          {selected.emoji} {selected.label}
        </span>
        <span className="text-slate-600 mx-2">·</span>
        <span className="text-xs sm:text-sm text-slate-500">
          {selected.description.split(' · ')[1]}
        </span>
      </div>
    </div>
  );
};

export default GradeLevelSelector;
