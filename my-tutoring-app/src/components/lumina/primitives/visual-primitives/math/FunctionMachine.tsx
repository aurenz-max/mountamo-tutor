'use client';

import React, { useState, useEffect } from 'react';
import CalculatorInput from '../../input-primitives/CalculatorInput';

export interface FunctionMachineData {
  title: string;
  description: string;
  rule?: string; // The transformation rule (e.g., "x + 3", "2x", "x^2")
  showRule?: boolean; // Display or hide the rule
  inputQueue?: number[]; // Values to process
  outputDisplay?: 'immediate' | 'animated' | 'hidden';
  chainable?: boolean; // Allow connecting machines
  ruleComplexity?: 'oneStep' | 'twoStep' | 'expression';
}

interface FunctionMachineProps {
  data: FunctionMachineData;
  className?: string;
}

const FunctionMachine: React.FC<FunctionMachineProps> = ({ data, className }) => {
  const {
    rule = '',
    showRule = false,
    inputQueue = [1, 2, 3, 4, 5],
    outputDisplay = 'animated',
    chainable = false,
  } = data;

  // Log component initialization
  useEffect(() => {
    console.log('[FunctionMachine] Initialized with data:', {
      rule,
      showRule,
      inputQueue,
      outputDisplay,
      hasValidRule: Boolean(rule && rule.trim())
    });
  }, []);

  // State management
  const [currentInput, setCurrentInput] = useState<number | null>(null);
  const [currentOutput, setCurrentOutput] = useState<number | null>(null);
  const [processedPairs, setProcessedPairs] = useState<Array<{ input: number; output: number }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [guessedRule, setGuessedRule] = useState('');
  const [showGuessInput, setShowGuessInput] = useState(false);
  const [guessResult, setGuessResult] = useState<'correct' | 'incorrect' | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [availableInputs, setAvailableInputs] = useState<number[]>(inputQueue);

  // Parse and evaluate the rule
  const evaluateRule = (x: number): number => {
    console.log(`[FunctionMachine] Evaluating rule for input: ${x}`);

    // Validate rule exists
    if (!rule || !rule.trim()) {
      console.error('[FunctionMachine] No rule provided - cannot evaluate');
      return NaN;
    }

    try {
      // Replace 'x' with the actual value and evaluate safely
      const expression = rule.replace(/x/g, String(x));
      console.log(`[FunctionMachine] Expression after substitution: ${expression}`);

      // Basic safety check - only allow numbers, operators, and basic functions
      if (!/^[\d+\-*/().^\s]+$/.test(expression)) {
        console.error('[FunctionMachine] Invalid rule expression - contains unsafe characters:', expression);
        return NaN;
      }

      // Use Function constructor for safe evaluation (limited scope)
      // Handle exponentiation
      const safeExpression = expression.replace(/\^/g, '**');
      const result = new Function('return ' + safeExpression)();
      const roundedResult = Math.round(result * 100) / 100; // Round to 2 decimals

      console.log(`[FunctionMachine] Result: ${x} -> ${roundedResult}`);
      return roundedResult;
    } catch (error) {
      console.error('[FunctionMachine] Error evaluating rule:', error);
      return NaN;
    }
  };

  // Process an input value through the machine
  const processValue = async (input: number) => {
    if (isProcessing) {
      console.log('[FunctionMachine] Already processing, ignoring request');
      return;
    }

    console.log(`[FunctionMachine] Processing value: ${input}`);
    setIsProcessing(true);
    setCurrentInput(input);
    setCurrentOutput(null);

    // Remove from available inputs
    setAvailableInputs(prev => prev.filter(v => v !== input));

    // Animate the processing
    await new Promise(resolve => setTimeout(resolve, 800));

    const output = evaluateRule(input);
    setCurrentOutput(output);
    console.log(`[FunctionMachine] Output calculated: ${output}`);

    // Wait for output display
    await new Promise(resolve => setTimeout(resolve, 600));

    // Add to processed pairs
    setProcessedPairs(prev => [...prev, { input, output }]);

    // Clear current values
    await new Promise(resolve => setTimeout(resolve, 400));
    setCurrentInput(null);
    setCurrentOutput(null);
    setIsProcessing(false);
    console.log('[FunctionMachine] Processing complete');
  };

  // Check if guessed rule is correct
  const checkGuess = () => {
    console.log('[FunctionMachine] Checking guess:', { guessedRule, actualRule: rule });

    // Validate inputs
    if (!rule || !rule.trim()) {
      console.error('[FunctionMachine] Cannot check guess - no rule defined');
      return;
    }

    if (!guessedRule || !guessedRule.trim()) {
      console.log('[FunctionMachine] Empty guess, ignoring');
      return;
    }

    // Normalize both rules for comparison
    const normalizeRule = (r: string) => {
      if (!r) return '';
      return r.replace(/\s/g, '').toLowerCase();
    };

    const normalizedGuess = normalizeRule(guessedRule);
    const normalizedRule = normalizeRule(rule);
    const isCorrect = normalizedGuess === normalizedRule;

    console.log('[FunctionMachine] Comparison:', {
      normalizedGuess,
      normalizedRule,
      isCorrect
    });

    setGuessResult(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      // Keep success message visible and don't auto-hide
      // User can reset to try again
    }
  };

  // Add custom input
  const addCustomInput = () => {
    const value = parseFloat(customInput);
    if (!isNaN(value) && !availableInputs.includes(value)) {
      setAvailableInputs(prev => [...prev, value]);
      setCustomInput('');
    }
  };

  // Reset the machine
  const reset = () => {
    setProcessedPairs([]);
    setCurrentInput(null);
    setCurrentOutput(null);
    setGuessedRule('');
    setGuessResult(null);
    setAvailableInputs(inputQueue);
    setShowGuessInput(false);
  };

  // Show error state if no rule
  if (!rule || !rule.trim()) {
    return (
      <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
        <div className="glass-panel p-8 rounded-3xl border border-red-500/20 bg-red-500/10">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-red-300 mb-2">Configuration Error</h3>
            <p className="text-red-200/80">No function rule provided. Please provide a valid rule (e.g., "x + 3", "2x", "x^2")</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-blue-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          {/* Improved Header - Integrated into the panel */}
          <div className="mb-8">
            {/* Challenge Badge */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-400/40">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                <span className="text-xs text-blue-300 font-mono uppercase tracking-wider">Math Challenge</span>
              </div>
            </div>

            {/* Title with Icon */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center border border-blue-400/40 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  <svg className="w-7 h-7 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  {data.title}
                </h2>
              </div>

              {/* Interactive instruction callout */}
              <div className="max-w-2xl mx-auto">
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/30">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <svg className="w-5 h-5 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
                      </svg>
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed text-left">
                      {data.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Success Celebration */}
          {guessResult === 'correct' && (
            <div className="mb-8 relative">
              {/* Confetti Background Effect */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute animate-bounce"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `-${Math.random() * 20}px`,
                      animationDelay: `${Math.random() * 0.5}s`,
                      animationDuration: `${1 + Math.random()}s`
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full opacity-80"
                      style={{
                        backgroundColor: ['#34d399', '#fbbf24', '#60a5fa', '#a78bfa', '#f87171'][i % 5]
                      }}
                    ></div>
                  </div>
                ))}
              </div>

              {/* Main Success Card */}
              <div className="relative p-8 bg-gradient-to-br from-green-500/30 via-emerald-500/20 to-teal-500/30 backdrop-blur-sm border-2 border-green-400/80 rounded-3xl text-center animate-fade-in shadow-[0_0_50px_rgba(34,197,94,0.5)] overflow-hidden">
                {/* Animated Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 via-transparent to-emerald-400/10 animate-pulse pointer-events-none"></div>

                <div className="relative z-10">
                  {/* Trophy Icon */}
                  <div className="mb-4 flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-yellow-400/50 rounded-full blur-xl animate-pulse"></div>
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center border-4 border-yellow-300/50 shadow-[0_0_40px_rgba(250,204,21,0.6)] animate-bounce">
                        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Success Message */}
                  <h3 className="text-3xl font-bold text-green-100 mb-2 animate-pulse">
                    🎉 Amazing Work! 🎉
                  </h3>
                  <p className="text-xl text-green-200 mb-4">
                    You discovered the secret rule!
                  </p>

                  {/* Revealed Rule */}
                  <div className="inline-block px-8 py-4 bg-slate-900/60 backdrop-blur-sm border-2 border-green-400/50 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                    <div className="text-sm text-green-300 mb-1 font-mono uppercase tracking-wider">The Rule Was:</div>
                    <div className="text-3xl font-bold text-white font-mono">
                      f(x) = {rule}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-6 flex justify-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-200">{processedPairs.length}</div>
                      <div className="text-xs text-green-300/80 uppercase tracking-wide">Tests Run</div>
                    </div>
                    <div className="w-px bg-green-400/30"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-200">✓</div>
                      <div className="text-xs text-green-300/80 uppercase tracking-wide">Solved</div>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <div className="mt-6">
                    <button
                      onClick={reset}
                      className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 border-2 border-green-300/50 text-white font-bold rounded-xl transition-all hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] hover:scale-105 active:scale-95"
                    >
                      Try Another Challenge
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* The Machine Visualization */}
          <div className="mb-8 p-8 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-blue-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none rounded-2xl"></div>

            <div className="relative z-10 flex items-center justify-center gap-8">
              {/* Input Hopper */}
              <div className="flex flex-col items-center">
                <div className="text-blue-400 text-sm font-mono mb-2 uppercase tracking-wide">Input</div>
                <div className="w-24 h-32 border-2 border-blue-400/50 rounded-t-lg bg-blue-500/10 backdrop-blur-sm relative overflow-hidden flex items-end justify-center pb-4">
                  {currentInput !== null && (
                    <div className="absolute top-2 animate-bounce">
                      <div className="w-12 h-12 rounded-full bg-blue-500/40 border-2 border-blue-400/70 flex items-center justify-center text-white font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                        {currentInput}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center">
                <svg className="w-16 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 64 32">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16 L56 16 M48 8 L56 16 L48 24"></path>
                </svg>
              </div>

              {/* Machine Body */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  {/* Gear decoration */}
                  <div className={`absolute -top-8 -right-8 w-12 h-12 ${isProcessing ? 'animate-spin' : ''}`}>
                    <svg className="w-full h-full text-blue-400/30" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l1.09 2.83L16 6l-2.83 1.09L12 10l-1.09-2.83L8 6l2.83-1.09L12 2zm-8 8l.545 1.414L6 12l-1.414.545L4 14l-.545-1.414L2 12l1.414-.545L4 10zm8 4l1.09 2.83L16 18l-2.83 1.09L12 22l-1.09-2.83L8 18l2.83-1.09L12 14z"></path>
                    </svg>
                  </div>

                  <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-400/50 backdrop-blur-sm flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                    {/* Glass effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

                    <div className="relative z-10 text-center">
                      <div className="text-blue-300 text-xs font-mono mb-2 uppercase">Function Rule</div>
                      {showRule ? (
                        <div className="text-2xl font-bold text-white mb-2 font-mono bg-slate-900/30 px-4 py-2 rounded-lg border border-blue-400/20">
                          f(x) = {rule}
                        </div>
                      ) : (
                        <div className="text-2xl font-bold text-blue-200 mb-2">
                          <div className="flex gap-1 justify-center">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-100"></span>
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-200"></span>
                          </div>
                        </div>
                      )}
                      {isProcessing && (
                        <div className="text-blue-300 text-xs animate-pulse">Processing...</div>
                      )}
                    </div>

                    {/* Processing animation overlay */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center">
                <svg className="w-16 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 64 32">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16 L56 16 M48 8 L56 16 L48 24"></path>
                </svg>
              </div>

              {/* Output Chute */}
              <div className="flex flex-col items-center">
                <div className="text-purple-400 text-sm font-mono mb-2 uppercase tracking-wide">Output</div>
                <div className="w-24 h-32 border-2 border-purple-400/50 rounded-b-lg bg-purple-500/10 backdrop-blur-sm relative overflow-hidden flex items-start justify-center pt-4">
                  {currentOutput !== null && outputDisplay !== 'hidden' && (
                    <div className={`absolute top-2 ${outputDisplay === 'animated' ? 'animate-bounce' : ''}`}>
                      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] ${
                        isNaN(currentOutput)
                          ? 'bg-red-500/40 border-red-400/70 text-white text-xs'
                          : 'bg-purple-500/40 border-purple-400/70 text-white'
                      }`}>
                        {isNaN(currentOutput) ? '!' : currentOutput}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* How to Use - appears only when no pairs processed yet */}
          {processedPairs.length === 0 && (
            <div className="mb-6 p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-sm rounded-xl border border-amber-400/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10 flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center border border-amber-400/40">
                    <svg className="w-5 h-5 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-amber-200 font-bold mb-2">How it works</h4>
                  <ol className="text-sm text-amber-100/90 space-y-1.5 list-decimal list-inside">
                    <li>Click an input number below to feed it into the machine</li>
                    <li>Watch the machine process it and produce an output</li>
                    <li>Study the input → output patterns to discover the hidden rule!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Input Queue */}
          <div className="mb-6 p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-blue-400">Available Inputs</h4>
                  {availableInputs.length > 0 && (
                    <span className="px-2 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-xs text-blue-300 font-mono">
                      {availableInputs.length} remaining
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {availableInputs.length > 0 ? (
                    availableInputs.map((value, idx) => (
                      <button
                        key={idx}
                        onClick={() => processValue(value)}
                        disabled={isProcessing}
                        className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/40 border-2 border-blue-400/50 hover:border-blue-400/80 text-white rounded-xl font-bold transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {value}
                      </button>
                    ))
                  ) : (
                    <p className="text-slate-400 text-sm">No inputs available. Add a custom value!</p>
                  )}
                </div>
              </div>

              {/* Calculator Input for Custom Values */}
              <div className="max-w-sm mx-auto">
                <CalculatorInput
                  label="Add Custom Value"
                  value={customInput}
                  onChange={setCustomInput}
                  onSubmit={addCustomInput}
                  placeholder="0"
                  showSubmitButton={true}
                  allowNegative={true}
                  allowDecimal={true}
                  maxLength={10}
                  disabled={isProcessing}
                />
              </div>
            </div>
          </div>

          {/* Processed Pairs */}
          {processedPairs.length > 0 && (
            <div className="mb-6 p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-purple-400">Input → Output Pairs</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-300/70">{processedPairs.length} tested</span>
                    {!showRule && processedPairs.length >= 2 && (
                      <span className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-xs text-amber-300 font-mono animate-pulse">
                        Ready to guess!
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {processedPairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border text-center transition-all ${
                        isNaN(pair.output)
                          ? 'bg-red-900/20 border-red-400/30'
                          : 'bg-slate-900/40 border-slate-600/30'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-blue-300 font-bold text-lg">{pair.input}</span>
                        <span className="text-slate-500">→</span>
                        <span className={`font-bold text-lg ${isNaN(pair.output) ? 'text-red-300' : 'text-purple-300'}`}>
                          {isNaN(pair.output) ? 'Error' : pair.output}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Guess the Rule */}
          {!showRule && processedPairs.length >= 2 && guessResult !== 'correct' && (
            <div className="mb-6 p-6 bg-amber-500/20 backdrop-blur-sm border-2 border-amber-400/60 rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h4 className="text-amber-200 font-bold mb-4 text-center text-lg">Can you guess the rule?</h4>
                <div className="flex items-center gap-4 justify-center">
                  <span className="text-amber-300">f(x) =</span>
                  <input
                    type="text"
                    value={guessedRule}
                    onChange={(e) => setGuessedRule(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && checkGuess()}
                    placeholder="Enter your guess"
                    className="flex-1 max-w-xs px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-amber-400/40 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 focus:outline-none"
                  />
                  <button
                    onClick={checkGuess}
                    className="px-6 py-2 bg-amber-500/40 hover:bg-amber-500/60 border border-amber-400/50 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:scale-105"
                  >
                    Check
                  </button>
                </div>
                {guessResult === 'incorrect' && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-400/60 rounded-lg text-center">
                    <span className="text-red-200 text-sm font-medium">Not quite! Try processing more values to find the pattern.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Controls */}
          {guessResult !== 'correct' && (
            <div className="flex gap-4 justify-center">
              <button
                onClick={reset}
                className="px-6 py-3 bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:scale-105"
              >
                Reset Machine
              </button>
              {!showRule && (
                <button
                  onClick={() => setShowGuessInput(!showGuessInput)}
                  className="px-6 py-3 bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/50 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:scale-105"
                >
                  {showGuessInput ? 'Hide' : 'Show'} Guess Panel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FunctionMachine;
