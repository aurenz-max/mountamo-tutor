import React from 'react';
import { ChemicalElement } from './types';
import { getCategoryStyle } from './constants';

interface PeriodicTableGridProps {
  elements: ChemicalElement[];
  onSelectElement: (element: ChemicalElement) => void;
  hoveredCategory: string | null;
  setHoveredCategory: (category: string | null) => void;
  /** DI reveal-on-affirm: emerald-ring these atomic numbers. Empty = none. */
  revealNumbers?: number[];
  /** DI wrong tap: red-ring this atomic number until the correction retry. */
  incorrectNumber?: number | null;
}

/**
 * The table with its AXES: group numbers across the top, period numbers down
 * the side — a real classroom periodic table prints both, and the judged
 * loop's position asks ("group 2, period 4") are unanswerable without them.
 * Layout is therefore 19 columns × 11 rows: row 1 and column 1 are labels,
 * element cells sit at (xpos+1, ypos+1).
 */
export const PeriodicTableGrid: React.FC<PeriodicTableGridProps> = ({
  elements,
  onSelectElement,
  hoveredCategory,
  setHoveredCategory,
  revealNumbers = [],
  incorrectNumber = null,
}) => {
  return (
    <div
      className="grid gap-1 p-2 md:p-4 min-w-[1040px] overflow-x-auto select-none"
      style={{ gridTemplateColumns: 'repeat(19, minmax(0, 1fr))' }}
    >
      {/* Group axis (columns 1-18) */}
      {Array.from({ length: 18 }, (_, i) => (
        <div
          key={`group-${i + 1}`}
          className="text-slate-500 text-[9px] md:text-[10px] font-mono flex items-end justify-center pb-0.5"
          style={{ gridColumn: i + 2, gridRow: 1 }}
        >
          {i + 1}
        </div>
      ))}

      {/* Period axis (rows 1-7) */}
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={`period-${i + 1}`}
          className="text-slate-500 text-[9px] md:text-[10px] font-mono flex items-center justify-end pr-1"
          style={{ gridColumn: 1, gridRow: i + 2 }}
        >
          {i + 1}
        </div>
      ))}

      {elements.map((element) => {
        const isDimmed = hoveredCategory && hoveredCategory !== element.category;
        const categoryStyle = getCategoryStyle(element.category);
        const isRevealed = revealNumbers.includes(element.number);
        const isIncorrect = incorrectNumber === element.number;

        return (
          <div
            key={element.number}
            onClick={() => onSelectElement(element)}
            onMouseEnter={() => setHoveredCategory(element.category)}
            onMouseLeave={() => setHoveredCategory(null)}
            className={`
              relative aspect-[4/5] flex flex-col items-center justify-between p-1 cursor-pointer
              transition-all duration-300 transform rounded-sm border
              hover:z-10 hover:scale-125 hover:shadow-xl hover:rounded-md
              ${isDimmed ? 'opacity-20 grayscale scale-95 blur-[1px]' : 'opacity-100'}
              ${isRevealed ? 'ring-2 ring-emerald-400 scale-110 z-10 shadow-lg shadow-emerald-500/30 rounded-md' : ''}
              ${isIncorrect ? 'ring-2 ring-red-400 z-10' : ''}
            `}
            style={{
              gridColumn: element.xpos + 1,
              gridRow: element.ypos + 1,
              ...categoryStyle
            }}
          >
             <span className="self-start text-[10px] md:text-xs font-mono opacity-70 leading-none">{element.number}</span>
             <span className="text-sm md:text-lg font-bold tracking-tighter">{element.symbol}</span>
             <span className="text-[8px] md:text-[9px] truncate w-full text-center opacity-80">{element.name}</span>
          </div>
        );
      })}

      {/* Placeholders for Lanthanides/Actinides Labels */}
      <div className="text-slate-600 text-xs flex items-center justify-center font-mono opacity-50 border border-slate-800 rounded" style={{ gridColumn: 4, gridRow: 7 }}>57-71</div>
      <div className="text-slate-600 text-xs flex items-center justify-center font-mono opacity-50 border border-slate-800 rounded" style={{ gridColumn: 4, gridRow: 8 }}>89-103</div>
    </div>
  );
};
