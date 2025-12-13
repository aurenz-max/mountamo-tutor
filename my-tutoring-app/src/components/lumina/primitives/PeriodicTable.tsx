import React, { useState, useMemo } from 'react';
import { Search, Atom } from 'lucide-react';
import { ChemicalElement } from './chemistry-primitives/types';
import { ELEMENTS } from './chemistry-primitives/constants';
import { PeriodicTableGrid } from './chemistry-primitives/PeriodicTableGrid';
import { ElementModal } from './chemistry-primitives/ElementModal';

export interface PeriodicTableData {
  title?: string;
  description?: string;
  highlightElements?: number[]; // Array of atomic numbers to highlight
  focusCategory?: string; // Optional category to focus on
}

interface PeriodicTableProps {
  data: PeriodicTableData;
  className?: string;
}

const PeriodicTable: React.FC<PeriodicTableProps> = ({ data, className }) => {
  const [selectedElement, setSelectedElement] = useState<ChemicalElement | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(data.focusCategory || null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredElements = useMemo(() => {
    if (!searchTerm) return ELEMENTS;
    const lower = searchTerm.toLowerCase();
    return ELEMENTS.filter(e =>
      e.name.toLowerCase().includes(lower) ||
      e.symbol.toLowerCase().includes(lower) ||
      e.number.toString() === lower
    );
  }, [searchTerm]);

  const categories = Array.from(new Set(ELEMENTS.map(e => e.category)));

  return (
    <div className={`w-full ${className || ''}`}>
      {/* Title Section */}
      {data.title && (
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-slate-100 mb-2">{data.title}</h3>
          {data.description && (
            <p className="text-slate-400 text-sm leading-relaxed">{data.description}</p>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search by name, symbol, or atomic number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 text-slate-200 text-sm rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent block w-full pl-10 p-2 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Atom size={16} />
          <span>{filteredElements.length} elements</span>
        </div>
      </div>

      {/* Category Legend / Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onMouseEnter={() => setHoveredCategory(cat)}
            onMouseLeave={() => setHoveredCategory(data.focusCategory || null)}
            onClick={() => setHoveredCategory(hoveredCategory === cat ? (data.focusCategory || null) : cat)}
            className={`
              text-[10px] uppercase font-bold px-3 py-1 rounded-full border transition-all
              ${hoveredCategory === cat
                ? 'bg-white text-slate-900 border-white scale-105 shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : 'bg-slate-900/40 text-slate-500 border-slate-800 hover:border-slate-600'}
            `}
          >
            {cat.replace('unknown, ', '')}
          </button>
        ))}
      </div>

      {/* Periodic Table - Horizontal scroll on mobile */}
      <div className="w-full overflow-x-auto pb-6 custom-scrollbar">
        <PeriodicTableGrid
          elements={filteredElements}
          onSelectElement={setSelectedElement}
          hoveredCategory={hoveredCategory}
          setHoveredCategory={setHoveredCategory}
        />
      </div>

      {/* Element Detail Modal */}
      {selectedElement && (
        <ElementModal
          element={selectedElement}
          allElements={ELEMENTS}
          onClose={() => setSelectedElement(null)}
        />
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 0.8);
        }
        .grid-cols-18 {
          grid-template-columns: repeat(18, minmax(0, 1fr));
        }
        .glass-panel {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PeriodicTable;
