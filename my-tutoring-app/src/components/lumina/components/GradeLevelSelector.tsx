'use client';

import React from 'react';

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
  description: string;
  emoji: string;
}

const gradeLevelOptions: GradeLevelOption[] = [
  {
    value: 'toddler',
    label: 'Toddler',
    description: 'Ages 1-3',
    emoji: '👶'
  },
  {
    value: 'preschool',
    label: 'Preschool',
    description: 'Ages 3-5',
    emoji: '🎨'
  },
  {
    value: 'kindergarten',
    label: 'Kindergarten',
    description: 'Ages 5-6',
    emoji: '🎒'
  },
  {
    value: 'elementary',
    label: 'Elementary',
    description: 'Grades 1-5',
    emoji: '📚'
  },
  {
    value: 'middle-school',
    label: 'Middle School',
    description: 'Grades 6-8',
    emoji: '🔬'
  },
  {
    value: 'high-school',
    label: 'High School',
    description: 'Grades 9-12',
    emoji: '🎓'
  },
  {
    value: 'undergraduate',
    label: 'Undergraduate',
    description: 'College Level',
    emoji: '🏛️'
  },
  {
    value: 'graduate',
    label: 'Graduate',
    description: 'Master\'s Level',
    emoji: '📖'
  },
  {
    value: 'phd',
    label: 'PhD',
    description: 'Doctoral Level',
    emoji: '🎯'
  }
];

interface GradeLevelSelectorProps {
  value: GradeLevel;
  onChange: (level: GradeLevel) => void;
  className?: string;
}

export const GradeLevelSelector: React.FC<GradeLevelSelectorProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedOption = gradeLevelOptions.find(opt => opt.value === value) || gradeLevelOptions[3];

  return (
    <div className={`relative ${className}`}>
      {/* Selector Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-blue-500/50 transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{selectedOption.emoji}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-white">{selectedOption.label}</div>
            <div className="text-xs text-slate-400">{selectedOption.description}</div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Options */}
          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
            {gradeLevelOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left ${
                  option.value === value
                    ? 'bg-blue-500/20 border-l-4 border-blue-500'
                    : 'hover:bg-slate-700/50'
                }`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{option.label}</div>
                  <div className="text-xs text-slate-400">{option.description}</div>
                </div>
                {option.value === value && (
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GradeLevelSelector;
