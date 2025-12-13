'use client';

import React from 'react';
import { SpotlightCard } from './SpotlightCard';

export type Subject =
  | 'mathematics'
  | 'science'
  | 'language-arts'
  | 'social-studies'
  | 'reading'
  | 'writing';

interface SubjectOption {
  value: Subject;
  label: string;
  description: string;
  emoji: string;
  category: string;
  color: string; // RGB format for SpotlightCard
}

const subjectOptions: SubjectOption[] = [
  {
    value: 'mathematics',
    label: 'Mathematics',
    description: 'Explore numbers, operations, geometry, and problem-solving',
    emoji: '🔢',
    category: 'STEM',
    color: '56, 189, 248' // sky-400
  },
  {
    value: 'science',
    label: 'Science',
    description: 'Discover biology, chemistry, physics, and the natural world',
    emoji: '🔬',
    category: 'STEM',
    color: '74, 222, 128' // green-400
  },
  {
    value: 'language-arts',
    label: 'Language Arts',
    description: 'Master grammar, vocabulary, and language structure',
    emoji: '📝',
    category: 'LITERACY',
    color: '192, 132, 252' // purple-400
  },
  {
    value: 'reading',
    label: 'Reading',
    description: 'Build comprehension skills and reading fluency',
    emoji: '📖',
    category: 'LITERACY',
    color: '248, 113, 113' // red-400
  },
  {
    value: 'social-studies',
    label: 'Social Studies',
    description: 'Journey through history, geography, and culture',
    emoji: '🌍',
    category: 'HUMANITIES',
    color: '250, 204, 21' // yellow-400
  },
  {
    value: 'writing',
    label: 'Writing',
    description: 'Develop composition and creative writing skills',
    emoji: '✍️',
    category: 'LITERACY',
    color: '167, 139, 250' // violet-400
  }
];

interface SubjectSelectorProps {
  value: Subject | null;
  onChange: (subject: Subject) => void;
  className?: string;
}

export const SubjectSelector: React.FC<SubjectSelectorProps> = ({
  value,
  onChange,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {subjectOptions.map((option) => (
        <div key={option.value} className="relative">
          <SpotlightCard
            color={option.color}
            onClick={() => onChange(option.value)}
            className={`bg-slate-900/40 transition-all duration-300 ${
              option.value === value ? 'scale-105' : ''
            }`}
          >
            <div className="p-6 flex items-start gap-4 relative">
              {/* Emoji Icon */}
              <div className="text-5xl flex-shrink-0">
                {option.emoji}
              </div>

              <div className="flex-1">
                {/* Category Label */}
                <div className="text-xs font-bold mb-1 uppercase tracking-wide"
                     style={{ color: `rgb(${option.color})` }}>
                  {option.category}
                </div>

                {/* Subject Title */}
                <h4 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
                  {option.label}
                </h4>

                {/* Description */}
                <p className="text-sm text-slate-400 leading-relaxed">
                  {option.description}
                </p>
              </div>

              {/* Selected Indicator */}
              {option.value === value && (
                <div className="absolute top-4 right-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                       style={{ backgroundColor: `rgba(${option.color}, 0.2)` }}>
                    <svg className="w-5 h-5" style={{ color: `rgb(${option.color})` }} fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </SpotlightCard>
        </div>
      ))}
    </div>
  );
};

export default SubjectSelector;
