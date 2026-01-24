'use client';

import React, { useState } from 'react';
import { usePrimitiveEvaluation, type FactorTreeMetrics } from '../../../evaluation';

export interface TreeNode {
  value: number;
  factors?: [number, number]; // The two factors that multiply to this value
  isPrime?: boolean;
}

export interface FactorTreeData {
  title: string;
  description: string;
  rootValue: number; // Starting composite number
  highlightPrimes?: boolean; // Visually distinguish prime leaves
  showExponentForm?: boolean; // Display final factorization
  guidedMode?: boolean; // Suggest valid factor pairs
  allowReset?: boolean; // Clear and restart

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<import('../../../evaluation').FactorTreeMetrics>) => void;
}

interface FactorTreeProps {
  data: FactorTreeData;
  className?: string;
}

const FactorTree: React.FC<FactorTreeProps> = ({ data, className }) => {
  const {
    rootValue,
    highlightPrimes = true,
    showExponentForm = true,
    guidedMode = true,
    allowReset = true,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Helper function to check if a number is prime
  const isPrime = (n: number): boolean => {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  };

  // Helper function to get valid factor pairs
  const getFactorPairs = (n: number): Array<[number, number]> => {
    const pairs: Array<[number, number]> = [];
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) {
        pairs.push([i, n / i]);
      }
    }
    return pairs;
  };

  // Initialize tree with root node
  const [tree, setTree] = useState<Map<string, TreeNode>>(
    new Map([['0', { value: rootValue, isPrime: isPrime(rootValue) }]])
  );

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [factorInput, setFactorInput] = useState<{ factor1: string; factor2: string }>({
    factor1: '',
    factor2: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Evaluation tracking state
  const [invalidSplitAttempts, setInvalidSplitAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [manualInputs, setManualInputs] = useState(0);
  const [resetCount, setResetCount] = useState(0);

  // Evaluation hook - tracks timing and handles submission
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<FactorTreeMetrics>({
    primitiveType: 'factor-tree',
    instanceId: instanceId || `factor-tree-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // Split a node into two factors
  const splitNode = (nodeId: string, factor1: number, factor2: number) => {
    const node = tree.get(nodeId);
    if (!node || node.factors) return; // Already split

    // Validate factors
    if (factor1 * factor2 !== node.value) {
      setError(`${factor1} × ${factor2} ≠ ${node.value}`);
      setInvalidSplitAttempts(prev => prev + 1); // Track error
      return;
    }

    if (factor1 === 1 || factor2 === 1) {
      setError('Factor pairs cannot include 1');
      setInvalidSplitAttempts(prev => prev + 1); // Track error
      return;
    }

    setError(null);

    // Update the node with factors
    const newTree = new Map(tree);
    newTree.set(nodeId, {
      ...node,
      factors: [factor1, factor2],
    });

    // Add children nodes
    newTree.set(`${nodeId}-0`, { value: factor1, isPrime: isPrime(factor1) });
    newTree.set(`${nodeId}-1`, { value: factor2, isPrime: isPrime(factor2) });

    setTree(newTree);
    setSelectedNode(null);
    setFactorInput({ factor1: '', factor2: '' });
  };

  // Get all leaf nodes (nodes without children)
  const getLeaves = (): number[] => {
    const leaves: number[] = [];
    tree.forEach((node, id) => {
      if (!node.factors) {
        leaves.push(node.value);
      }
    });
    return leaves.sort((a, b) => a - b);
  };

  // Check if all leaves are prime
  const allLeavesPrime = (): boolean => {
    return getLeaves().every((value) => isPrime(value));
  };

  // Get prime factorization in exponential form
  const getPrimeFactorization = (): string => {
    const leaves = getLeaves();
    const counts = new Map<number, number>();

    leaves.forEach((prime) => {
      counts.set(prime, (counts.get(prime) || 0) + 1);
    });

    const factors: string[] = [];
    Array.from(counts.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([prime, count]) => {
        if (count === 1) {
          factors.push(`${prime}`);
        } else {
          factors.push(`${prime}^${count}`);
        }
      });

    return factors.join(' × ');
  };

  // Reset the tree
  const resetTree = () => {
    setTree(new Map([['0', { value: rootValue, isPrime: isPrime(rootValue) }]]));
    setSelectedNode(null);
    setFactorInput({ factor1: '', factor2: '' });
    setError(null);
    setResetCount(prev => prev + 1); // Track reset
    resetEvaluationAttempt(); // Reset evaluation attempt
  };

  // Calculate optimal splits (minimum depth of factorization)
  const calculateOptimalSplits = (n: number): number => {
    let count = 0;
    let temp = n;
    for (let i = 2; i <= temp; i++) {
      while (temp % i === 0) {
        count++;
        temp /= i;
      }
    }
    return count - 1; // Splits = factors - 1
  };

  // Get tree depth
  const getTreeDepth = (nodeId: string): number => {
    const node = tree.get(nodeId);
    if (!node || !node.factors) return 0;
    return 1 + Math.max(
      getTreeDepth(`${nodeId}-0`),
      getTreeDepth(`${nodeId}-1`)
    );
  };

  // Handle evaluation submission
  const handleSubmitEvaluation = () => {
    if (hasSubmittedEvaluation || !isComplete) return;

    const leaves = getLeaves();
    const totalSplits = tree.size - leaves.length; // Non-leaf nodes = splits
    const optimalSplits = calculateOptimalSplits(rootValue);

    // Calculate factor distribution
    const factorDistribution: Record<number, number> = {};
    leaves.forEach(prime => {
      factorDistribution[prime] = (factorDistribution[prime] || 0) + 1;
    });

    // Check if used largest factor first (good strategy)
    const firstSplit = tree.get('0-0');
    const secondSplit = tree.get('0-1');
    const usedLargestFirst = firstSplit && secondSplit &&
      (firstSplit.value >= secondSplit.value);

    const success = isComplete;
    const score = Math.max(0, 100 - (invalidSplitAttempts * 10) - (resetCount * 15));

    const metrics: FactorTreeMetrics = {
      type: 'factor-tree',
      targetNumber: rootValue,
      factorizationComplete: isComplete,
      finalFactorization: getPrimeFactorization(),

      allFactorsValid: invalidSplitAttempts === 0,
      invalidSplitAttempts,

      totalPrimeFactors: leaves.length,
      uniquePrimes: Array.from(new Set(leaves)).sort((a, b) => a - b),
      factorDistribution,

      totalSplits,
      optimalSplits,
      efficiency: totalSplits > 0 ? optimalSplits / totalSplits : 1,
      usedLargestFactorFirst: usedLargestFirst || false,

      hintsUsed,
      manualInputs,
      resetCount,

      treeDepth: getTreeDepth('0'),
    };

    submitEvaluation(success, score, metrics, {
      studentWork: {
        tree: Array.from(tree.entries()),
        finalFactorization: getPrimeFactorization(),
      },
    });
  };

  // Render a tree node recursively
  const renderNode = (nodeId: string, depth: number = 0): JSX.Element | null => {
    const node = tree.get(nodeId);
    if (!node) return null;

    const isLeaf = !node.factors;
    const isSelected = selectedNode === nodeId;
    const canSplit = isLeaf && !node.isPrime;

    return (
      <div key={nodeId} className="flex flex-col items-center">
        {/* Node Circle */}
        <button
          onClick={() => canSplit && setSelectedNode(isSelected ? null : nodeId)}
          disabled={!canSplit}
          className={`
            w-16 h-16 rounded-full border-2 flex items-center justify-center font-bold text-lg
            transition-all duration-300 mb-2 relative backdrop-blur-sm
            ${
              node.isPrime && highlightPrimes
                ? 'bg-green-500/30 border-green-400/60 text-green-100 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:bg-green-500/40 hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] hover:scale-105'
                : isSelected
                ? 'bg-purple-500/40 border-purple-400/70 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105 ring-2 ring-purple-400/50'
                : canSplit
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-100 hover:bg-amber-500/30 hover:border-amber-400/70 cursor-pointer hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:scale-105'
                : 'bg-slate-800/40 border-slate-600/50 text-slate-400'
            }
            ${!canSplit && !node.isPrime ? 'opacity-50' : ''}
          `}
          title={node.isPrime ? 'Prime number' : canSplit ? 'Click to split' : 'Already split'}
        >
          {/* Glass effect inner glow */}
          {(node.isPrime || canSplit) && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          )}
          <span className="relative z-10">{node.value}</span>
        </button>

        {/* Children */}
        {node.factors && (
          <div className="flex gap-8 relative">
            {/* Connecting Lines */}
            <svg className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2" width="200" height="40">
              <defs>
                <linearGradient id={`line-gradient-${nodeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <line x1="100" y1="0" x2="50" y2="40" stroke={`url(#line-gradient-${nodeId})`} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="100" y1="0" x2="150" y2="40" stroke={`url(#line-gradient-${nodeId})`} strokeWidth="2.5" strokeLinecap="round" />
            </svg>

            <div className="pt-8">{renderNode(`${nodeId}-0`, depth + 1)}</div>
            <div className="pt-8">{renderNode(`${nodeId}-1`, depth + 1)}</div>
          </div>
        )}
      </div>
    );
  };

  const validPairs = selectedNode ? getFactorPairs(tree.get(selectedNode)?.value || 0) : [];
  const isComplete = allLeavesPrime();

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Factor Tree</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <p className="text-xs text-amber-400 font-mono uppercase tracking-wider">Prime Factorization Tool</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-amber-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Completion Banner */}
          {isComplete && (
            <div className="mb-6 p-6 bg-green-500/20 backdrop-blur-sm border-2 border-green-400/60 rounded-2xl text-center animate-fade-in shadow-[0_0_30px_rgba(34,197,94,0.3)] relative overflow-hidden">
              {/* Glass effect background */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

              <div className="relative z-10">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-green-400/30 flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
                    </svg>
                  </div>
                  <span className="text-green-200 font-bold text-xl">All leaves are prime!</span>
                </div>
                {showExponentForm && (
                  <div className="text-white font-mono text-xl bg-slate-900/30 backdrop-blur-sm py-2 px-4 rounded-lg border border-green-400/20 mb-4">
                    {rootValue} = {getPrimeFactorization()}
                  </div>
                )}

                {/* Submit button */}
                {!hasSubmittedEvaluation && instanceId && (
                  <button
                    onClick={handleSubmitEvaluation}
                    className="px-6 py-3 bg-green-500/40 backdrop-blur-sm hover:bg-green-500/60 border border-green-400/50 hover:border-green-400/80 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:scale-105"
                  >
                    Submit Solution
                  </button>
                )}
                {hasSubmittedEvaluation && (
                  <p className="text-green-300 text-sm">Solution submitted!</p>
                )}
              </div>
            </div>
          )}

          {/* Tree Visualization */}
          <div className="mb-8 p-8 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-amber-500/20 overflow-x-auto relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none rounded-2xl"></div>
            <div className="min-w-max mx-auto flex justify-center relative z-10">{renderNode('0')}</div>
          </div>

          {/* Factor Input Panel */}
          {selectedNode && (
            <div className="mb-6 p-6 bg-purple-500/20 backdrop-blur-sm border-2 border-purple-400/60 rounded-2xl animate-fade-in shadow-[0_0_25px_rgba(168,85,247,0.3)] relative overflow-hidden">
              {/* Glass effect background */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

              <div className="relative z-10">
                <h4 className="text-purple-200 font-bold mb-5 text-center text-lg">
                  Split {tree.get(selectedNode)?.value} into factors
                </h4>

                <div className="flex items-center gap-4 justify-center mb-4">
                  <input
                    type="number"
                    value={factorInput.factor1}
                    onChange={(e) => setFactorInput({ ...factorInput, factor1: e.target.value })}
                    placeholder="Factor 1"
                    className="w-24 px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg border border-purple-400/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none text-center transition-all"
                  />
                  <span className="text-purple-300 text-xl font-bold">×</span>
                  <input
                    type="number"
                    value={factorInput.factor2}
                    onChange={(e) => setFactorInput({ ...factorInput, factor2: e.target.value })}
                    placeholder="Factor 2"
                    className="w-24 px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg border border-purple-400/40 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 focus:outline-none text-center transition-all"
                  />
                  <button
                    onClick={() => {
                      const f1 = parseInt(factorInput.factor1);
                      const f2 = parseInt(factorInput.factor2);
                      if (!isNaN(f1) && !isNaN(f2)) {
                        setManualInputs(prev => prev + 1); // Track manual input
                        splitNode(selectedNode, f1, f2);
                      }
                    }}
                    className="px-6 py-2 bg-purple-500/40 backdrop-blur-sm hover:bg-purple-500/60 border border-purple-400/50 hover:border-purple-400/80 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-105"
                  >
                    Split
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 backdrop-blur-sm border border-red-400/60 rounded-lg text-center shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <span className="text-red-200 text-sm font-medium">{error}</span>
                  </div>
                )}

                {guidedMode && validPairs.length > 0 && (
                  <div className="mt-4">
                    <p className="text-purple-300 text-sm mb-3 text-center font-medium">Suggested factor pairs:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {validPairs.map(([f1, f2], idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setHintsUsed(prev => prev + 1); // Track hint usage
                            splitNode(selectedNode, f1, f2);
                          }}
                          className="px-4 py-2 bg-slate-700/50 backdrop-blur-sm hover:bg-amber-500/30 text-white rounded-lg text-sm transition-all border border-slate-600/50 hover:border-amber-400/60 hover:shadow-[0_0_12px_rgba(251,191,36,0.3)] hover:scale-105"
                        >
                          {f1} × {f2}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current Factorization */}
          {!isComplete && showExponentForm && getLeaves().length > 1 && (
            <div className="mb-6 p-5 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/40 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <p className="text-amber-400 text-sm mb-2 font-medium uppercase tracking-wide">Current factorization:</p>
                <p className="text-white font-mono text-lg">
                  {rootValue} = {getLeaves().join(' × ')}
                </p>
              </div>
            </div>
          )}

          {/* Legend & Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Legend */}
            <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h4 className="text-sm font-mono uppercase tracking-wider text-amber-400 mb-4">Legend</h4>
                <div className="space-y-3 text-sm text-slate-200">
                  {highlightPrimes && (
                    <div className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-full bg-green-500/30 border-2 border-green-400/60 backdrop-blur-sm transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]"></div>
                      <span className="group-hover:text-white transition-colors">Prime numbers (cannot be split further)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 border-2 border-amber-400/50 backdrop-blur-sm transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.4)]"></div>
                    <span className="group-hover:text-white transition-colors">Composite numbers (can be split into factors)</span>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-purple-500/40 border-2 border-purple-400/70 backdrop-blur-sm ring-2 ring-purple-400/30 transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]"></div>
                    <span className="group-hover:text-white transition-colors">Selected node (ready to split)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h4 className="text-sm font-mono uppercase tracking-wider text-amber-400 mb-4">How to Use</h4>
                <ul className="text-sm text-slate-200 space-y-2">
                  <li className="flex items-start gap-2 hover:text-white transition-colors">
                    <span className="text-amber-400 mt-1">▸</span>
                    <span>Click on a composite number to select it</span>
                  </li>
                  <li className="flex items-start gap-2 hover:text-white transition-colors">
                    <span className="text-amber-400 mt-1">▸</span>
                    <span>Enter two factors that multiply to the selected number</span>
                  </li>
                  {guidedMode && (
                    <li className="flex items-start gap-2 hover:text-white transition-colors">
                      <span className="text-amber-400 mt-1">▸</span>
                      <span>Or choose from suggested factor pairs</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2 hover:text-white transition-colors">
                    <span className="text-amber-400 mt-1">▸</span>
                    <span>Continue until all leaves are prime numbers</span>
                  </li>
                </ul>

                {allowReset && (
                  <button
                    onClick={resetTree}
                    className="mt-5 w-full px-4 py-2 bg-red-500/30 backdrop-blur-sm hover:bg-red-500/50 border border-red-400/50 hover:border-red-400/80 text-white rounded-lg font-semibold transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:scale-105"
                  >
                    Reset Tree
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FactorTree;
