'use client';

import React, { useState } from 'react';
import { VisualPrimitiveRenderer } from '@/components/practice/visuals/VisualPrimitiveRenderer';

// Dummy data matching backend schemas
const visualExamples = {
  math: [
    {
      name: 'Number Line',
      type: 'number-line',
      data: {
        min: 0,
        max: 20,
        step: 1,
        markers: [5, 12],
        markerColors: ['#3B82F6', '#EF4444'],
        markerLabels: ['Start', 'End'],
        highlightRange: { start: 5, end: 12, color: '#FDE68A' },
        showArrows: true
      }
    },
    {
      name: 'Fraction Circles',
      type: 'fraction-circles',
      data: {
        circles: [
          { segments: 4, shaded: 1, label: '1/4' },
          { segments: 4, shaded: 2, label: '2/4' },
          { segments: 8, shaded: 4, label: '4/8' }
        ],
        shadedColor: '#3B82F6',
        unshadedColor: '#E5E7EB'
      }
    },
    {
      name: 'Bar Model',
      type: 'bar-model',
      data: {
        bars: [
          { label: 'Apples', value: 8, color: '#EF4444' },
          { label: 'Oranges', value: 5, color: '#F97316' },
          { label: 'Bananas', value: 12, color: '#FBBF24' }
        ],
        showValues: true,
        orientation: 'horizontal'
      }
    },
    {
      name: 'Geometric Shape',
      type: 'geometric-shape',
      data: {
        shape: 'rectangle',
        width: 8,
        height: 5,
        unit: 'cm',
        color: '#10B981',
        showDimensions: true,
        showGrid: false
      }
    },
    {
      name: 'Base-Ten Blocks',
      type: 'base-ten-blocks',
      data: {
        hundreds: 2,
        tens: 3,
        ones: 7,
        showLabels: true
      }
    }
  ],
  science: [
    {
      name: 'Labeled Diagram',
      type: 'labeled-diagram',
      data: {
        imageUrl: 'https://placehold.co/400x300/e0f2fe/1e40af?text=Plant+Diagram',
        labels: [
          { text: 'Leaf', x: 50, y: 20, lineToX: 45, lineToY: 35 },
          { text: 'Stem', x: 50, y: 60, lineToX: 48, lineToY: 55 },
          { text: 'Roots', x: 50, y: 90, lineToX: 47, lineToY: 85 }
        ]
      }
    },
    {
      name: 'Cycle Diagram',
      type: 'cycle-diagram',
      data: {
        stages: [
          { name: 'Egg', icon: '🥚', description: 'Butterfly lays egg on leaf' },
          { name: 'Caterpillar', icon: '🐛', description: 'Larva hatches and eats' },
          { name: 'Chrysalis', icon: '🦋', description: 'Metamorphosis occurs' },
          { name: 'Butterfly', icon: '🦋', description: 'Adult emerges' }
        ],
        arrangement: 'circular'
      }
    },
    {
      name: 'Tree Diagram',
      type: 'tree-diagram',
      data: {
        root: {
          label: 'Animals',
          children: [
            {
              label: 'Vertebrates',
              icon: '🦴',
              children: [
                { label: 'Mammals', icon: '🐕' },
                { label: 'Birds', icon: '🦅' }
              ]
            },
            {
              label: 'Invertebrates',
              icon: '🐚',
              children: [
                { label: 'Insects', icon: '🐝' },
                { label: 'Mollusks', icon: '🐌' }
              ]
            }
          ]
        }
      }
    },
    {
      name: 'Line Graph',
      type: 'line-graph',
      data: {
        title: 'Plant Growth Over Time',
        xLabel: 'Days',
        yLabel: 'Height (cm)',
        points: [
          { x: 0, y: 2 },
          { x: 7, y: 5 },
          { x: 14, y: 9 },
          { x: 21, y: 14 },
          { x: 28, y: 18 }
        ]
      }
    },
    {
      name: 'Thermometer',
      type: 'thermometer',
      data: {
        min: -20,
        max: 120,
        unit: '°F',
        currentValue: 72,
        markers: [32, 98.6],
        markerLabels: ['Freezing', 'Body Temp']
      }
    }
  ],
  languageArts: [
    {
      name: 'Sentence Diagram',
      type: 'sentence-diagram',
      data: {
        sentence: 'The quick brown fox jumps over the lazy dog',
        parts: [
          { word: 'The', type: 'article', color: '#93C5FD' },
          { word: 'quick', type: 'adjective', color: '#FDE047' },
          { word: 'brown', type: 'adjective', color: '#FDE047' },
          { word: 'fox', type: 'noun', color: '#86EFAC' },
          { word: 'jumps', type: 'verb', color: '#FCA5A5' },
          { word: 'over', type: 'preposition', color: '#C4B5FD' },
          { word: 'the', type: 'article', color: '#93C5FD' },
          { word: 'lazy', type: 'adjective', color: '#FDE047' },
          { word: 'dog', type: 'noun', color: '#86EFAC' }
        ]
      }
    },
    {
      name: 'Story Sequence',
      type: 'story-sequence',
      data: {
        events: [
          { stage: 'Beginning', text: 'A girl finds a magical key', image: '🔑' },
          { stage: 'Middle', text: 'She unlocks a secret door', image: '🚪' },
          { stage: 'End', text: 'She discovers a treasure', image: '💎' }
        ],
        layout: 'horizontal'
      }
    },
    {
      name: 'Word Web',
      type: 'word-web',
      data: {
        center: { word: 'Happy', size: 'large' },
        branches: [
          { word: 'Joyful', color: '#FBBF24' },
          { word: 'Cheerful', color: '#F59E0B' },
          { word: 'Delighted', color: '#F97316' },
          { word: 'Content', color: '#FB923C' }
        ]
      }
    },
    {
      name: 'Character Web',
      type: 'character-web',
      data: {
        character: { name: 'Little Red Riding Hood', icon: '👧' },
        traits: [
          { trait: 'Brave', evidence: 'Goes through forest alone' },
          { trait: 'Kind', evidence: 'Brings food to grandma' },
          { trait: 'Curious', evidence: 'Asks wolf many questions' }
        ]
      }
    },
    {
      name: 'Venn Diagram',
      type: 'venn-diagram',
      data: {
        circles: [
          { label: 'Fiction', color: '#93C5FD', items: ['Made up stories', 'Has characters', 'Has plot'] },
          { label: 'Non-fiction', color: '#FCA5A5', items: ['Real facts', 'Informative', 'True events'] }
        ],
        overlap: ['Can have illustrations', 'Tell stories', 'Written in books']
      }
    }
  ],
  abcs: [
    {
      name: 'Letter Tracing',
      type: 'letter-tracing',
      data: {
        letter: 'A',
        case: 'uppercase',
        showDirectionArrows: true,
        showDottedGuide: true,
        strokeOrder: [
          { path: 'M20,80 L50,20', number: 1 },
          { path: 'M50,20 L80,80', number: 2 },
          { path: 'M30,55 L70,55', number: 3 }
        ]
      }
    },
    {
      name: 'Letter-Picture Match',
      type: 'letter-picture',
      data: {
        letter: 'B',
        items: [
          { name: 'Ball', image: '⚽', highlight: true },
          { name: 'Bear', image: '🐻', highlight: true },
          { name: 'Banana', image: '🍌', highlight: true },
          { name: 'Cat', image: '🐱', highlight: false }
        ]
      }
    },
    {
      name: 'Alphabet Sequence',
      type: 'alphabet-sequence',
      data: {
        sequence: ['A', 'B', '_', 'D', 'E'],
        missing: ['C'],
        highlightMissing: true,
        showImages: false
      }
    },
    {
      name: 'Rhyming Pairs',
      type: 'rhyming-pairs',
      data: {
        pairs: [
          { word1: 'Cat', image1: '🐱', word2: 'Hat', image2: '🎩' },
          { word1: 'Dog', image1: '🐕', word2: 'Frog', image2: '🐸' }
        ],
        showConnectingLines: true
      }
    },
    {
      name: 'Sight Word Card',
      type: 'sight-word-card',
      data: {
        word: 'the',
        fontSize: 'large',
        showInContext: true,
        sentence: 'The cat sat on the mat.',
        highlightWord: true
      }
    },
    {
      name: 'Sound Sort',
      type: 'sound-sort',
      data: {
        targetSound: 'short a',
        categories: [
          { label: 'Has short a', words: ['cat', 'hat', 'mat', 'bat'] },
          { label: 'No short a', words: ['dog', 'run', 'sit', 'top'] }
        ],
        showPictures: false
      }
    }
  ]
};

export default function VisualGalleryPage() {
  const [selectedCategory, setSelectedCategory] = useState<'math' | 'science' | 'languageArts' | 'abcs'>('math');

  const categories = [
    { key: 'math' as const, label: '➕ Math', color: 'bg-blue-100 border-blue-500 text-blue-900' },
    { key: 'science' as const, label: '🔬 Science', color: 'bg-green-100 border-green-500 text-green-900' },
    { key: 'languageArts' as const, label: '📚 Language Arts', color: 'bg-purple-100 border-purple-500 text-purple-900' },
    { key: 'abcs' as const, label: '🔤 ABCs', color: 'bg-yellow-100 border-yellow-500 text-yellow-900' }
  ];

  const currentExamples = visualExamples[selectedCategory];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Visual Primitives Gallery</h1>
          <p className="text-gray-600">
            Preview all {Object.values(visualExamples).flat().length} visual components with sample data
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {categories.map(category => (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all border-2 ${
                selectedCategory === category.key
                  ? category.color
                  : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-700'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border-2 border-blue-300">
            <div className="text-3xl font-bold text-blue-600">{visualExamples.math.length}</div>
            <div className="text-sm text-gray-600">Math Primitives</div>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-green-300">
            <div className="text-3xl font-bold text-green-600">{visualExamples.science.length}</div>
            <div className="text-sm text-gray-600">Science Primitives</div>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-purple-300">
            <div className="text-3xl font-bold text-purple-600">{visualExamples.languageArts.length}</div>
            <div className="text-sm text-gray-600">Language Arts</div>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-yellow-300">
            <div className="text-3xl font-bold text-yellow-600">{visualExamples.abcs.length}</div>
            <div className="text-sm text-gray-600">ABCs/Phonics</div>
          </div>
        </div>

        {/* Visual Examples Grid */}
        <div className="space-y-8">
          {currentExamples.map((example, index) => (
            <div key={index} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-4 border-b-4 border-indigo-500">
                <h2 className="text-xl font-bold text-white">{example.name}</h2>
                <p className="text-sm text-gray-300 font-mono mt-1">type: "{example.type}"</p>
              </div>

              {/* Visual */}
              <div className="p-8 bg-gray-50">
                <VisualPrimitiveRenderer
                  visualData={{ type: example.type, data: example.data }}
                  className=""
                />
              </div>

              {/* JSON Schema */}
              <details className="border-t-2 border-gray-200">
                <summary className="p-4 bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors font-semibold text-gray-700">
                  📄 View JSON Data Schema
                </summary>
                <div className="p-4 bg-gray-900">
                  <pre className="text-xs text-green-400 overflow-x-auto">
                    {JSON.stringify({ type: example.type, data: example.data }, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 p-6 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg border-2 border-indigo-300">
          <h3 className="font-bold text-lg mb-3 text-indigo-900">Implementation Notes</h3>
          <ul className="space-y-2 text-sm text-indigo-800">
            <li>✅ All 20 visual primitives fully implemented</li>
            <li>✅ Each component matches backend schema exactly</li>
            <li>✅ Components use Tailwind CSS for consistent styling</li>
            <li>✅ Graceful error handling and fallback behavior</li>
            <li>✅ Responsive design for mobile and desktop</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
