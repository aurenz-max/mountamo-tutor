'use client';

import React, { useState, useEffect } from 'react';

export interface BalanceScaleObject {
  value: number;
  label?: string;
  isVariable?: boolean; // True for "x", false for constants
}

export interface BalanceScaleData {
  title: string;
  description: string;
  leftSide: BalanceScaleObject[]; // Objects on left pan
  rightSide: BalanceScaleObject[]; // Objects on right pan
  variableValue: number; // Hidden value of x (for solution)
  showTilt?: boolean; // Animate imbalance
  allowOperations?: ('add' | 'subtract' | 'multiply' | 'divide')[]; // Permitted solving moves
  stepHistory?: string[]; // Track solution steps
}

interface BalanceScaleProps {
  data: BalanceScaleData;
  className?: string;
}

const BalanceScale: React.FC<BalanceScaleProps> = ({ data, className }) => {
  const {
    title,
    description,
    leftSide = [],
    rightSide = [],
    variableValue,
    showTilt = true,
    allowOperations = ['add', 'subtract'],
  } = data;

  const [currentLeftSide, setCurrentLeftSide] = useState<BalanceScaleObject[]>(leftSide);
  const [currentRightSide, setCurrentRightSide] = useState<BalanceScaleObject[]>(rightSide);
  const [userSteps, setUserSteps] = useState<string[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [hoveredSide, setHoveredSide] = useState<'left' | 'right' | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<'add' | 'subtract' | 'multiply' | 'divide' | null>(null);
  const [operationValue, setOperationValue] = useState<string>('');
  const [hint, setHint] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<BalanceScaleObject | null>(null);
  const [dropTarget, setDropTarget] = useState<'left' | 'right' | null>(null);

  // Calculate total values for each side
  const calculateSideValue = (side: BalanceScaleObject[]): number => {
    return side.reduce((sum, obj) => {
      const value = obj.isVariable ? variableValue : obj.value;
      return sum + value;
    }, 0);
  };

  const leftValue = calculateSideValue(currentLeftSide);
  const rightValue = calculateSideValue(currentRightSide);
  const isBalanced = Math.abs(leftValue - rightValue) < 0.01;

  // Calculate tilt angle based on difference
  const calculateTiltAngle = (): number => {
    if (!showTilt || isBalanced) return 0;
    const diff = leftValue - rightValue;
    // Max 15 degrees tilt
    return Math.max(-15, Math.min(15, diff * 0.5));
  };

  const tiltAngle = calculateTiltAngle();

  // Format object display
  const formatObject = (obj: BalanceScaleObject): string => {
    if (obj.isVariable) {
      return obj.label || 'x';
    }
    return obj.label || String(obj.value);
  };

  // Get object color
  const getObjectColor = (obj: BalanceScaleObject): string => {
    if (obj.isVariable) {
      return 'bg-gradient-to-br from-purple-500 to-pink-500 border-purple-400';
    }
    return 'bg-gradient-to-br from-blue-500 to-cyan-500 border-blue-400';
  };

  // Check if equation is solved (variable isolated)
  const isSolved = (): boolean => {
    const leftHasOnlyVariable = currentLeftSide.length === 1 && currentLeftSide[0].isVariable;
    const rightHasOnlyConstants = currentRightSide.every(obj => !obj.isVariable) && currentRightSide.length >= 1;
    const rightHasOnlyVariable = currentRightSide.length === 1 && currentRightSide[0].isVariable;
    const leftHasOnlyConstants = currentLeftSide.every(obj => !obj.isVariable) && currentLeftSide.length >= 1;

    return (leftHasOnlyVariable && rightHasOnlyConstants) || (rightHasOnlyVariable && leftHasOnlyConstants);
  };

  const solved = isSolved();

  // Remove object from a side (applies to both sides to maintain balance)
  const removeObject = (side: 'left' | 'right', index: number) => {
    const obj = side === 'left' ? currentLeftSide[index] : currentRightSide[index];

    if (!obj) return;

    // Find matching object on the other side
    const otherSide = side === 'left' ? currentRightSide : currentLeftSide;
    const otherIndex = otherSide.findIndex(o =>
      o.isVariable === obj.isVariable && o.value === obj.value
    );

    if (otherIndex === -1) {
      setHint(`To keep the scale balanced, you need to remove the same value from both sides!`);
      setTimeout(() => setHint(null), 3000);
      return;
    }

    // Remove from both sides
    const newLeft = side === 'left'
      ? currentLeftSide.filter((_, i) => i !== index)
      : currentLeftSide.filter((_, i) => i !== otherIndex);

    const newRight = side === 'right'
      ? currentRightSide.filter((_, i) => i !== index)
      : currentRightSide.filter((_, i) => i !== otherIndex);

    setCurrentLeftSide(newLeft);
    setCurrentRightSide(newRight);

    // Log the step
    const stepDescription = `Removed ${formatObject(obj)} from both sides`;
    setUserSteps([...userSteps, stepDescription]);
    setHint(`Great! ${stepDescription}`);
    setTimeout(() => setHint(null), 2000);
  };

  // Apply operation to both sides
  const applyOperation = () => {
    if (!selectedOperation || !operationValue) return;

    const value = parseFloat(operationValue);
    if (isNaN(value) || value <= 0) {
      setHint('Please enter a valid positive number');
      setTimeout(() => setHint(null), 2000);
      return;
    }

    let newLeft = [...currentLeftSide];
    let newRight = [...currentRightSide];
    let stepDescription = '';

    if (selectedOperation === 'add') {
      // Add value to both sides
      newLeft.push({ value, label: String(value) });
      newRight.push({ value, label: String(value) });
      stepDescription = `Added ${value} to both sides`;
    } else if (selectedOperation === 'subtract') {
      // Subtract value from both sides
      const subtractObj = { value, label: String(value) };

      // Check if we can subtract (must have the value on both sides)
      const canSubtract = newLeft.some(o => !o.isVariable && o.value === value) &&
                          newRight.some(o => !o.isVariable && o.value === value);

      if (!canSubtract) {
        setHint(`You need ${value} on both sides to subtract it!`);
        setTimeout(() => setHint(null), 2000);
        return;
      }

      // Remove first occurrence from each side
      const leftIdx = newLeft.findIndex(o => !o.isVariable && o.value === value);
      const rightIdx = newRight.findIndex(o => !o.isVariable && o.value === value);

      if (leftIdx !== -1) newLeft.splice(leftIdx, 1);
      if (rightIdx !== -1) newRight.splice(rightIdx, 1);

      stepDescription = `Subtracted ${value} from both sides`;
    }

    setCurrentLeftSide(newLeft);
    setCurrentRightSide(newRight);
    setUserSteps([...userSteps, stepDescription]);
    setOperationValue('');
    setSelectedOperation(null);
    setHint(`${stepDescription}!`);
    setTimeout(() => setHint(null), 2000);
  };

  // Reset to initial state
  const handleReset = () => {
    setCurrentLeftSide(leftSide);
    setCurrentRightSide(rightSide);
    setUserSteps([]);
    setShowSolution(false);
    setHint(null);
    setSelectedOperation(null);
    setOperationValue('');
  };

  // Provide a hint for next step
  const provideHint = () => {
    // Find constants on the same side as variable
    const leftHasVar = currentLeftSide.some(o => o.isVariable);
    const rightHasVar = currentRightSide.some(o => o.isVariable);

    if (leftHasVar && !rightHasVar) {
      const constants = currentLeftSide.filter(o => !o.isVariable);
      if (constants.length > 0) {
        setHint(`Try removing ${formatObject(constants[0])} from both sides to isolate the variable`);
      } else {
        setHint(`You've isolated the variable! Click 'Show Solution' to check your answer`);
      }
    } else if (rightHasVar && !leftHasVar) {
      const constants = currentRightSide.filter(o => !o.isVariable);
      if (constants.length > 0) {
        setHint(`Try removing ${formatObject(constants[0])} from both sides to isolate the variable`);
      } else {
        setHint(`You've isolated the variable! Click 'Show Solution' to check your answer`);
      }
    } else {
      setHint('Remove constants from the side with the variable, one step at a time');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (block: BalanceScaleObject) => {
    setDraggedBlock(block);
  };

  const handleDragOver = (e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    setDropTarget(side);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    if (!draggedBlock) return;

    // Add the block to the specified side
    const newBlock = { ...draggedBlock };

    if (side === 'left') {
      setCurrentLeftSide([...currentLeftSide, newBlock]);
    } else {
      setCurrentRightSide([...currentRightSide, newBlock]);
    }

    const stepDescription = `Added ${formatObject(newBlock)} to ${side} side`;
    setUserSteps([...userSteps, stepDescription]);
    setHint(`${stepDescription}!`);
    setTimeout(() => setHint(null), 2000);

    setDraggedBlock(null);
    setDropTarget(null);
  };

  // Available blocks to drag
  const availableBlocks: BalanceScaleObject[] = [
    { value: 1, label: '1' },
    { value: 5, label: '5' },
    { value: 10, label: '10' },
  ];

  // Render objects on a pan
  const renderObjects = (objects: BalanceScaleObject[], side: 'left' | 'right') => {
    if (objects.length === 0) {
      return <span className="text-slate-400 text-sm italic">Empty</span>;
    }

    return objects.map((obj, index) => (
      <button
        key={`${side}-${index}`}
        onClick={() => removeObject(side, index)}
        className={`
          ${getObjectColor(obj)}
          border-2 rounded-lg px-4 py-3
          shadow-lg
          transition-all duration-300
          hover:scale-110 hover:shadow-xl hover:ring-2 hover:ring-yellow-400
          flex items-center justify-center
          min-w-[60px]
          cursor-pointer
          active:scale-95
        `}
        title={`Click to remove ${formatObject(obj)} from both sides`}
      >
        <span className="text-white font-bold text-lg font-mono">
          {formatObject(obj)}
        </span>
      </button>
    ));
  };

  return (
    <div className={`w-full max-w-7xl mx-auto my-16 animate-fade-in ${className || ''} flex gap-6`}>
      {/* Draggable Block Palette */}
      <div className="w-48 shrink-0">
        <div className="glass-panel p-4 rounded-2xl border border-blue-500/20 sticky top-4">
          <h3 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Add Blocks
          </h3>
          <div className="space-y-3">
            {availableBlocks.map((block, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => handleDragStart(block)}
                className={`
                  ${getObjectColor(block)}
                  border-2 rounded-lg px-4 py-3
                  shadow-lg
                  transition-all duration-300
                  hover:scale-105 hover:shadow-xl hover:ring-2 hover:ring-blue-400
                  flex items-center justify-center
                  cursor-grab active:cursor-grabbing
                  active:scale-95
                `}
                title={`Drag ${formatObject(block)} to either pan`}
              >
                <span className="text-white font-bold text-lg font-mono">
                  {formatObject(block)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-400 italic">
              Drag blocks onto the scale to balance the equation
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-bold text-white tracking-tight">Balance Scale</h2>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-xs text-green-400 font-mono uppercase tracking-wider">
                Interactive Equation Solving
              </p>
            </div>
          </div>
        </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-green-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Balance Status & Hint */}
          <div className="mb-6 text-center space-y-3">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${
              isBalanced
                ? 'bg-green-500/20 border border-green-500/50'
                : 'bg-yellow-500/20 border border-yellow-500/50'
            }`}>
              <span className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></span>
              <span className={`font-mono text-sm font-bold ${isBalanced ? 'text-green-300' : 'text-yellow-300'}`}>
                {isBalanced ? 'BALANCED ✓' : 'UNBALANCED'}
              </span>
              {solved && (
                <>
                  <span className="text-slate-500">|</span>
                  <span className="text-purple-300 font-mono text-sm font-bold">SOLVED! 🎉</span>
                </>
              )}
            </div>

            {hint && (
              <div className="inline-block px-6 py-3 bg-blue-500/20 border border-blue-500/50 rounded-full">
                <span className="text-blue-300 text-sm">💡 {hint}</span>
              </div>
            )}
          </div>

          {/* Balance Scale Visual */}
          <div className="relative flex flex-col items-center mb-8">
            {/* Fulcrum (Triangle) */}
            <div className="relative w-full max-w-3xl flex justify-center mb-4">
              {/* Beam */}
              <div
                className="absolute w-full h-3 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-full shadow-lg transition-transform duration-700 ease-in-out"
                style={{
                  top: '60px',
                  transform: `rotate(${tiltAngle}deg)`,
                  transformOrigin: 'center'
                }}
              ></div>

              {/* Center Pivot */}
              <div className="absolute" style={{ top: '60px' }}>
                <div className="w-8 h-8 bg-slate-700 rounded-full border-4 border-slate-500 shadow-xl z-20"></div>
              </div>

              {/* Fulcrum Base */}
              <div className="absolute" style={{ top: '80px' }}>
                <div className="w-0 h-0 border-l-[30px] border-l-transparent border-r-[30px] border-r-transparent border-b-[50px] border-b-slate-700"></div>
              </div>

              {/* Left Pan */}
              <div
                className={`absolute left-0 transition-all duration-700 ${hoveredSide === 'left' ? 'scale-105' : ''}`}
                style={{
                  top: `${60 + tiltAngle * 2}px`,
                  left: '5%',
                }}
                onMouseEnter={() => setHoveredSide('left')}
                onMouseLeave={() => setHoveredSide(null)}
              >
                {/* Suspension Strings */}
                <div className="absolute left-1/2 -translate-x-1/2 w-1 h-12 bg-slate-600 -top-12"></div>

                {/* Pan */}
                <div className="w-48 h-4 bg-gradient-to-b from-slate-500 to-slate-600 rounded-t-lg shadow-lg"></div>
                <div
                  className={`w-48 min-h-[128px] bg-gradient-to-br from-slate-600/40 to-slate-700/60 rounded-b-2xl border-2 ${
                    dropTarget === 'left' ? 'border-green-400 shadow-lg shadow-green-400/50' : 'border-slate-500/50'
                  } backdrop-blur-sm p-3 flex flex-wrap gap-2 items-center justify-center`}
                  onDragOver={(e) => handleDragOver(e, 'left')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'left')}
                >
                  {renderObjects(currentLeftSide, 'left')}
                </div>
              </div>

              {/* Right Pan */}
              <div
                className={`absolute right-0 transition-all duration-700 ${hoveredSide === 'right' ? 'scale-105' : ''}`}
                style={{
                  top: `${60 - tiltAngle * 2}px`,
                  right: '5%',
                }}
                onMouseEnter={() => setHoveredSide('right')}
                onMouseLeave={() => setHoveredSide(null)}
              >
                {/* Suspension Strings */}
                <div className="absolute left-1/2 -translate-x-1/2 w-1 h-12 bg-slate-600 -top-12"></div>

                {/* Pan */}
                <div className="w-48 h-4 bg-gradient-to-b from-slate-500 to-slate-600 rounded-t-lg shadow-lg"></div>
                <div
                  className={`w-48 min-h-[128px] bg-gradient-to-br from-slate-600/40 to-slate-700/60 rounded-b-2xl border-2 ${
                    dropTarget === 'right' ? 'border-green-400 shadow-lg shadow-green-400/50' : 'border-slate-500/50'
                  } backdrop-blur-sm p-3 flex flex-wrap gap-2 items-center justify-center`}
                  onDragOver={(e) => handleDragOver(e, 'right')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'right')}
                >
                  {renderObjects(currentRightSide, 'right')}
                </div>
              </div>
            </div>

            {/* Spacing for the scale visual */}
            <div className="h-64"></div>

            {/* Equation Display */}
            <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
              <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
                Current Equation
              </h4>
              <div className="flex items-center justify-center gap-4 text-2xl font-mono font-bold">
                <div className="text-blue-300">
                  {currentLeftSide.length > 0
                    ? currentLeftSide.map(obj => formatObject(obj)).join(' + ')
                    : '0'
                  }
                </div>
                <span className="text-slate-500">=</span>
                <div className="text-cyan-300">
                  {currentRightSide.length > 0
                    ? currentRightSide.map(obj => formatObject(obj)).join(' + ')
                    : '0'
                  }
                </div>
              </div>

              {/* Value Display */}
              <div className="mt-4 pt-4 border-t border-slate-600 flex items-center justify-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Left:</span>
                  <span className="text-blue-300 font-mono font-bold">{leftValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Right:</span>
                  <span className="text-cyan-300 font-mono font-bold">{rightValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Solution Controls */}
          {solved && (
            <div className="mb-6 p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-mono uppercase tracking-wider text-green-400">
                  🎉 Solution Found!
                </h4>
                <button
                  onClick={() => setShowSolution(!showSolution)}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-green-300 text-sm font-mono transition-all"
                >
                  {showSolution ? 'Hide' : 'Show'} Variable Value
                </button>
              </div>
              {showSolution && (
                <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-center gap-3 text-2xl font-mono font-bold">
                    <span className="text-purple-300">x</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-pink-300">{variableValue}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Steps History */}
          {userSteps.length > 0 && (
            <div className="mb-6 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
              <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
                Your Steps ({userSteps.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {userSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-300 font-mono font-bold text-xs shrink-0">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Control Panel */}
          <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400">
                Controls
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={provideHint}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-300 text-sm font-mono transition-all"
                >
                  💡 Hint
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300 text-sm font-mono transition-all"
                >
                  🔄 Reset
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="pt-4 border-t border-slate-600">
              <h5 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">How to Play</h5>
              <ul className="text-sm text-slate-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">▸</span>
                  <span><strong>Click on blocks</strong> to remove them from both sides (maintains balance)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">▸</span>
                  <span>Purple/pink blocks are variables (x), blue blocks are constants</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">▸</span>
                  <span><strong>Goal:</strong> Isolate the variable on one side to solve the equation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">▸</span>
                  <span>The scale tilts when unbalanced - keep it level!</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default BalanceScale;
