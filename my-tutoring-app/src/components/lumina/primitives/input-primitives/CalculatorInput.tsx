'use client';

import React, { useState } from 'react';

export interface CalculatorInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  showSubmitButton?: boolean;
  maxLength?: number;
  allowNegative?: boolean;
  allowDecimal?: boolean;
  className?: string;
}

/**
 * CalculatorInput - A Lumina-themed calculator-style number input component
 *
 * Features:
 * - Glass-panel styling matching Lumina design language
 * - Calculator-style keypad with 0-9, decimal, negative, clear, and backspace
 * - Optional submit button with green gradient
 * - Orange accent theming
 * - Smooth animations and hover effects
 * - Configurable to allow/disallow decimals and negative numbers
 */
const CalculatorInput: React.FC<CalculatorInputProps> = ({
  label,
  value,
  onChange,
  onSubmit,
  placeholder = '0',
  disabled = false,
  showSubmitButton = true,
  maxLength = 10,
  allowNegative = true,
  allowDecimal = true,
  className = '',
}) => {
  const handleInput = (digit: string) => {
    if (disabled) return;

    const currentValue = value || '';

    if (digit === 'C') {
      onChange('');
    } else if (digit === '⌫') {
      onChange(currentValue.slice(0, -1));
    } else if (digit === '-' && allowNegative && currentValue === '') {
      onChange('-');
    } else if (digit === '.' && allowDecimal && !currentValue.includes('.')) {
      onChange(currentValue + '.');
    } else if (!isNaN(parseInt(digit))) {
      if (currentValue.length < maxLength) {
        onChange(currentValue + digit);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Glass Panel Container */}
      <div className="glass-panel p-6 rounded-2xl border border-orange-500/20 relative overflow-hidden">
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(#f97316 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Label (if provided) */}
          {label && (
            <div className="mb-4 text-center">
              <div className="text-sm text-slate-400 font-mono uppercase tracking-wider">{label}</div>
            </div>
          )}

          {/* Calculator Display */}
          <div className="mb-4">
            <div className="bg-slate-900/80 border-2 border-orange-500/30 rounded-xl p-4 shadow-[0_0_30px_rgba(249,115,22,0.15)]">
              <div className="text-right">
                <div
                  className="text-3xl font-bold text-orange-400 font-mono tracking-wider min-h-[2.5rem] flex items-center justify-end"
                  onKeyPress={handleKeyPress}
                  tabIndex={0}
                >
                  {value || placeholder}
                </div>
              </div>
            </div>
          </div>

          {/* Calculator Keypad */}
          <div className="grid grid-cols-4 gap-2">
            {/* Row 1: 7, 8, 9, C */}
            {['7', '8', '9', 'C'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleInput(btn)}
                disabled={disabled}
                className={`
                  h-12 rounded-lg font-bold text-base transition-all duration-200
                  ${btn === 'C'
                    ? 'bg-red-600/20 border-2 border-red-500/40 text-red-400 hover:bg-red-600/30 hover:border-red-500/60'
                    : 'bg-slate-800/50 border-2 border-orange-500/30 text-white hover:bg-orange-500/20 hover:border-orange-500/50'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                  shadow-lg
                `}
              >
                {btn}
              </button>
            ))}

            {/* Row 2: 4, 5, 6, ⌫ */}
            {['4', '5', '6', '⌫'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleInput(btn)}
                disabled={disabled}
                className={`
                  h-12 rounded-lg font-bold text-base transition-all duration-200
                  ${btn === '⌫'
                    ? 'bg-slate-700/50 border-2 border-slate-500/40 text-slate-300 hover:bg-slate-700/70 hover:border-slate-500/60'
                    : 'bg-slate-800/50 border-2 border-orange-500/30 text-white hover:bg-orange-500/20 hover:border-orange-500/50'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                  shadow-lg
                `}
              >
                {btn}
              </button>
            ))}

            {/* Row 3: 1, 2, 3, - */}
            {['1', '2', '3'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleInput(btn)}
                disabled={disabled}
                className={`
                  h-12 rounded-lg font-bold text-base transition-all duration-200
                  bg-slate-800/50 border-2 border-orange-500/30 text-white
                  hover:bg-orange-500/20 hover:border-orange-500/50
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                  shadow-lg
                `}
              >
                {btn}
              </button>
            ))}

            {allowNegative ? (
              <button
                onClick={() => handleInput('-')}
                disabled={disabled}
                className={`
                  h-12 rounded-lg font-bold text-base transition-all duration-200
                  bg-slate-800/50 border-2 border-orange-500/30 text-white
                  hover:bg-orange-500/20 hover:border-orange-500/50
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                  shadow-lg
                `}
              >
                -
              </button>
            ) : (
              <div className="h-12"></div>
            )}

            {/* Row 4: 0 (spanning 2 cols), ., Submit */}
            <button
              onClick={() => handleInput('0')}
              disabled={disabled}
              className={`
                col-span-2 h-12 rounded-lg font-bold text-base transition-all duration-200
                bg-slate-800/50 border-2 border-orange-500/30 text-white
                hover:bg-orange-500/20 hover:border-orange-500/50
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                shadow-lg
              `}
            >
              0
            </button>

            {allowDecimal ? (
              <button
                onClick={() => handleInput('.')}
                disabled={disabled}
                className={`
                  h-12 rounded-lg font-bold text-base transition-all duration-200
                  bg-slate-800/50 border-2 border-orange-500/30 text-white
                  hover:bg-orange-500/20 hover:border-orange-500/50
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                  shadow-lg
                `}
              >
                .
              </button>
            ) : (
              <div className="h-12"></div>
            )}

            {/* Submit Button */}
            {showSubmitButton && onSubmit && (
              <button
                onClick={onSubmit}
                disabled={disabled || !value}
                className={`
                  h-12 rounded-lg font-bold text-base transition-all duration-200
                  bg-gradient-to-br from-green-600 to-emerald-600 border-2 border-green-500/50 text-white
                  hover:from-green-500 hover:to-emerald-500 hover:border-green-400/60
                  disabled:from-slate-700 disabled:to-slate-800 disabled:border-slate-600 disabled:text-slate-500
                  shadow-[0_0_20px_rgba(34,197,94,0.3)]
                  disabled:shadow-none disabled:cursor-not-allowed
                  ${disabled || !value ? 'opacity-50' : 'hover:scale-105 active:scale-95'}
                `}
              >
                ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorInput;
