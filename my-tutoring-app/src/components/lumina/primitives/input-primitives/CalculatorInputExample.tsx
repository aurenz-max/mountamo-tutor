'use client';

import React, { useState } from 'react';
import CalculatorInput from './CalculatorInput';

/**
 * Example component showing how to use CalculatorInput in different scenarios
 */
const CalculatorInputExample: React.FC = () => {
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [answer3, setAnswer3] = useState('');
  const [feedback1, setFeedback1] = useState<string | null>(null);

  const handleSubmit1 = () => {
    const userAnswer = parseFloat(answer1);
    const correctAnswer = 42;

    if (userAnswer === correctAnswer) {
      setFeedback1('correct');
    } else {
      setFeedback1('incorrect');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-8 space-y-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-2">Calculator Input Examples</h1>
        <p className="text-slate-400">Reusable Lumina-themed calculator input component</p>
      </div>

      {/* Example 1: Full-featured calculator with validation */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Example 1: Math Problem Solver</h2>
        <div className="mb-4 text-center">
          <p className="text-lg text-slate-300">What is 6 × 7?</p>
        </div>
        <CalculatorInput
          label="Your Answer ="
          value={answer1}
          onChange={setAnswer1}
          onSubmit={handleSubmit1}
          showSubmitButton={true}
          allowNegative={false}
          allowDecimal={false}
        />
        {feedback1 === 'correct' && (
          <div className="mt-4 p-4 bg-green-500/20 border-2 border-green-500/50 rounded-xl text-center">
            <div className="text-green-400 font-bold">✓ Correct!</div>
          </div>
        )}
        {feedback1 === 'incorrect' && (
          <div className="mt-4 p-4 bg-red-500/20 border-2 border-red-500/50 rounded-xl text-center">
            <div className="text-red-400 font-bold">✗ Try again!</div>
          </div>
        )}
      </div>

      {/* Example 2: Calculator without submit button (auto-save) */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Example 2: Real-time Input</h2>
        <p className="text-sm text-slate-400 mb-4">No submit button - value updates in real-time</p>
        <CalculatorInput
          label="Enter any number"
          value={answer2}
          onChange={setAnswer2}
          showSubmitButton={false}
          allowNegative={true}
          allowDecimal={true}
        />
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-center">
          <div className="text-sm text-slate-400">Current value:</div>
          <div className="text-xl font-bold text-orange-400">{answer2 || '0'}</div>
        </div>
      </div>

      {/* Example 3: Integer-only calculator */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Example 3: Integer Only</h2>
        <p className="text-sm text-slate-400 mb-4">No decimals or negative numbers allowed</p>
        <CalculatorInput
          label="Positive integer only"
          value={answer3}
          onChange={setAnswer3}
          onSubmit={() => alert(`You entered: ${answer3}`)}
          showSubmitButton={true}
          allowNegative={false}
          allowDecimal={false}
          maxLength={5}
        />
      </div>

      {/* Usage Instructions */}
      <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-3">Usage Instructions</h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="font-mono bg-slate-900/50 p-3 rounded">
            <div className="text-orange-400 mb-2">import CalculatorInput from './CalculatorInput';</div>
            <div className="text-slate-400">{`<CalculatorInput`}</div>
            <div className="text-slate-400 ml-4">{`label="x ="`}</div>
            <div className="text-slate-400 ml-4">{`value={answer}`}</div>
            <div className="text-slate-400 ml-4">{`onChange={setAnswer}`}</div>
            <div className="text-slate-400 ml-4">{`onSubmit={handleSubmit}`}</div>
            <div className="text-slate-400 ml-4">{`showSubmitButton={true}`}</div>
            <div className="text-slate-400 ml-4">{`allowNegative={true}`}</div>
            <div className="text-slate-400 ml-4">{`allowDecimal={true}`}</div>
            <div className="text-slate-400">{`/>`}</div>
          </div>
          <div className="mt-4">
            <div className="font-semibold text-white mb-2">Props:</div>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li><code className="text-orange-400">label</code>: Optional label shown above the display</li>
              <li><code className="text-orange-400">value</code>: Current input value (controlled)</li>
              <li><code className="text-orange-400">onChange</code>: Callback when value changes</li>
              <li><code className="text-orange-400">onSubmit</code>: Optional callback when submit button is clicked</li>
              <li><code className="text-orange-400">showSubmitButton</code>: Show/hide the submit (✓) button</li>
              <li><code className="text-orange-400">allowNegative</code>: Allow negative numbers (default: true)</li>
              <li><code className="text-orange-400">allowDecimal</code>: Allow decimal numbers (default: true)</li>
              <li><code className="text-orange-400">maxLength</code>: Maximum number of characters (default: 10)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorInputExample;
