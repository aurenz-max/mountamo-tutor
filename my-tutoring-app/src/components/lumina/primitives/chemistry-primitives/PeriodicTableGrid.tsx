import React from 'react';
import { ChemicalElement } from './types';
import { getCategoryStyle } from './constants';

interface PeriodicTableGridProps {
  elements: ChemicalElement[];
  onSelectElement: (element: ChemicalElement) => void;
  hoveredCategory: string | null;
  setHoveredCategory: (category: string | null) => void;
}

export const PeriodicTableGrid: React.FC<PeriodicTableGridProps> = ({
  elements,
  onSelectElement,
  hoveredCategory,
  setHoveredCategory
}) => {
  return (
    <div className="grid grid-cols-18 gap-1 p-2 md:p-4 min-w-[1000px] overflow-x-auto select-none perspective-1000">
      {elements.map((element) => {
        const isDimmed = hoveredCategory && hoveredCategory !== element.category;
        const categoryStyle = getCategoryStyle(element.category);

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
            `}
            style={{
              gridColumn: element.xpos,
              gridRow: element.ypos,
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
      <div className="col-start-3 row-start-6 text-slate-600 text-xs flex items-center justify-center font-mono opacity-50 border border-slate-800 rounded">57-71</div>
      <div className="col-start-3 row-start-7 text-slate-600 text-xs flex items-center justify-center font-mono opacity-50 border border-slate-800 rounded">89-103</div>
    </div>
  );
};
