'use client';

import React, { useState } from 'react';
import { ObjectCollection } from '../primitives/visual-primitives/ObjectCollection';
import { ComparisonPanel } from '../primitives/visual-primitives/ComparisonPanel';
import { AlphabetSequence } from '../primitives/visual-primitives/AlphabetSequence';
import { RhymingPairs } from '../primitives/visual-primitives/RhymingPairs';
import { SightWordCard } from '../primitives/visual-primitives/SightWordCard';
import { SoundSort } from '../primitives/visual-primitives/SoundSort';
import { LetterPicture } from '../primitives/visual-primitives/LetterPicture';

// Static sample data for the dev gallery — instantiated once at module load,
// not on every App render.
const EXAMPLES: Array<{ name: string; component: React.ReactNode }> = [
  {
    name: 'Object Collection',
    component: (
      <ObjectCollection
        data={{
          instruction: 'Count the apples',
          items: [
            { name: 'apple', count: 5, icon: '🍎' },
            { name: 'orange', count: 3, icon: '🍊' }
          ],
          layout: 'grid'
        }}
      />
    )
  },
  {
    name: 'Comparison Panel',
    component: (
      <ComparisonPanel
        data={{
          panels: [
            {
              label: 'Group A',
              collection: {
                instruction: 'Red fruits',
                items: [{ name: 'apple', count: 4, icon: '🍎' }],
                layout: 'grid'
              }
            },
            {
              label: 'Group B',
              collection: {
                instruction: 'Yellow fruits',
                items: [{ name: 'banana', count: 3, icon: '🍌' }],
                layout: 'grid'
              }
            }
          ]
        }}
      />
    )
  },
  {
    name: 'Alphabet Sequence',
    component: (
      <AlphabetSequence
        data={{
          sequence: ['A', 'B', '_', 'D', 'E'],
          missing: ['C'],
          highlightMissing: true,
          showImages: true
        }}
      />
    )
  },
  {
    name: 'Rhyming Pairs',
    component: (
      <RhymingPairs
        data={{
          pairs: [
            { word1: 'cat', image1: '🐱', word2: 'hat', image2: '🎩' },
            { word1: 'dog', image1: '🐶', word2: 'log', image2: '🪵' }
          ],
          showConnectingLines: true
        }}
      />
    )
  },
  {
    name: 'Sight Word Card',
    component: (
      <SightWordCard
        data={{
          word: 'the',
          fontSize: 'large',
          showInContext: true,
          sentence: 'Look at the cat in the hat.',
          highlightWord: true
        }}
      />
    )
  },
  {
    name: 'Sound Sort',
    component: (
      <SoundSort
        data={{
          targetSound: 'short a',
          categories: [
            { label: 'Has short a', words: ['cat', 'hat', 'bat', 'mat'] },
            { label: 'No short a', words: ['dog', 'run', 'pig'] }
          ],
          showPictures: true
        }}
      />
    )
  },
  {
    name: 'Letter Picture',
    component: (
      <LetterPicture
        data={{
          letter: 'B',
          items: [
            { name: 'Ball', image: '🏀', highlight: true },
            { name: 'Book', image: '📚', highlight: true },
            { name: 'Cat', image: '🐱', highlight: false },
            { name: 'Bear', image: '🐻', highlight: true }
          ]
        }}
      />
    )
  }
];

interface VisualPrimitivesGalleryProps {
  onBack: () => void;
}

export const VisualPrimitivesGallery: React.FC<VisualPrimitivesGalleryProps> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="flex-1 animate-fade-in">
      <div className="mb-8 text-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Home
        </button>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Visual Primitives Gallery</h2>
        <p className="text-slate-400">Preview all early learning visual components</p>
      </div>

      <div className="flex items-center justify-center gap-4 mb-8">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Previous
        </button>

        <div className="px-6 py-3 bg-slate-800/80 rounded-lg border border-slate-600">
          <span className="text-white font-bold">
            {currentIndex + 1} / {EXAMPLES.length}
          </span>
          <span className="text-slate-400 ml-2">- {EXAMPLES[currentIndex].name}</span>
        </div>

        <button
          onClick={() => setCurrentIndex(Math.min(EXAMPLES.length - 1, currentIndex + 1))}
          disabled={currentIndex === EXAMPLES.length - 1}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all disabled:cursor-not-allowed flex items-center gap-2"
        >
          Next
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-4xl mx-auto">
        {EXAMPLES.map((example, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentIndex === index
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {example.name}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto">{EXAMPLES[currentIndex].component}</div>
    </div>
  );
};
