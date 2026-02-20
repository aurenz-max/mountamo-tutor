import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Search, Atom } from 'lucide-react';
import { PeriodicTableData } from '../types';
import { ChemicalElement } from './chemistry-primitives/types';
import { ELEMENTS } from './chemistry-primitives/constants';
import { PeriodicTableGrid } from './chemistry-primitives/PeriodicTableGrid';
import { ElementModal } from './chemistry-primitives/ElementModal';
import { useLuminaAI } from '../hooks/useLuminaAI';

interface PeriodicTableProps {
  data: PeriodicTableData;
  className?: string;
}

const PeriodicTable: React.FC<PeriodicTableProps> = ({ data, className }) => {
  const [selectedElement, setSelectedElement] = useState<ChemicalElement | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(data.focusCategory || null);
  const [searchTerm, setSearchTerm] = useState('');

  // Track exploration for AI context
  const elementsExploredRef = useRef<Set<number>>(new Set());
  const categoriesExploredRef = useRef<Set<string>>(new Set());
  const groupsExploredRef = useRef<Map<number, string[]>>(new Map());

  const { instanceId, gradeBand } = data;
  const resolvedInstanceId = instanceId || `periodic-table-${Date.now()}`;

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

  // AI primitive data — updates when selection changes
  const aiPrimitiveData = useMemo(() => ({
    title: data.title || 'Periodic Table',
    focusCategory: data.focusCategory || null,
    selectedElementName: selectedElement?.name || null,
    selectedElementSymbol: selectedElement?.symbol || null,
    selectedElementNumber: selectedElement?.number || null,
    selectedElementCategory: selectedElement?.category || null,
    selectedElementGroup: selectedElement?.group || null,
    selectedElementPeriod: selectedElement?.period || null,
    selectedElementValence: selectedElement
      ? selectedElement.electron_shells[selectedElement.electron_shells.length - 1]
      : null,
    selectedElementPhase: selectedElement?.phase || null,
    hoveredCategory,
    elementsExplored: elementsExploredRef.current.size,
    categoriesExplored: categoriesExploredRef.current.size,
  }), [data.title, data.focusCategory, selectedElement, hoveredCategory]);

  const { sendText } = useLuminaAI({
    primitiveType: 'periodic-table',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand,
  });

  // Handle element selection with AI triggers
  const handleSelectElement = useCallback((element: ChemicalElement) => {
    setSelectedElement(element);

    const isFirstExploration = elementsExploredRef.current.size === 0;
    elementsExploredRef.current.add(element.number);
    categoriesExploredRef.current.add(element.category);
    const explored = elementsExploredRef.current.size;

    // Track group exploration for trend detection
    const group = element.group;
    if (group) {
      const groupElements = groupsExploredRef.current.get(group) || [];
      if (!groupElements.includes(element.name)) {
        groupElements.push(element.name);
        groupsExploredRef.current.set(group, groupElements);
      }
    }

    const valence = element.electron_shells[element.electron_shells.length - 1];

    if (isFirstExploration) {
      // First element click — introduce and encourage exploration
      sendText(
        `[ELEMENT_SELECTED] Student clicked their first element: ${element.name} (${element.symbol}), ` +
        `atomic number ${element.number}, a ${element.category}. ` +
        `It has ${valence} valence electrons and is a ${element.phase.toLowerCase()} at room temperature. ` +
        `Briefly introduce this element and encourage the student to explore more elements, ` +
        `especially others in the same group (column ${element.group}) to discover patterns.`,
        { silent: true }
      );
    } else if (group && (groupsExploredRef.current.get(group)?.length || 0) >= 2) {
      // Student explored 2+ elements in the same group — highlight periodic trend
      const groupMembers = groupsExploredRef.current.get(group)!;
      sendText(
        `[GROUP_TREND] Student clicked ${element.name} (${element.symbol}) in group ${group}. ` +
        `They've now explored ${groupMembers.length} elements in this group: ${groupMembers.join(', ')}. ` +
        `Briefly point out what these elements have in common (similar valence electrons, ` +
        `similar reactivity) and one key trend (e.g., atomic radius increases going down the group).`,
        { silent: true }
      );
    } else if (explored === 10) {
      // Milestone — explored 10 unique elements
      sendText(
        `[EXPLORATION_MILESTONE] Student has now explored 10 unique elements! ` +
        `Just clicked ${element.name} (${element.symbol}). ` +
        `Categories explored: ${Array.from(categoriesExploredRef.current).join(', ')}. ` +
        `Celebrate their curiosity and summarize one interesting pattern they might have noticed.`,
        { silent: true }
      );
    } else {
      // Regular element selection — brief context
      sendText(
        `[ELEMENT_SELECTED] Student clicked ${element.name} (${element.symbol}), ` +
        `atomic number ${element.number}, group ${element.group}, period ${element.period}. ` +
        `Category: ${element.category}. Phase: ${element.phase}. Valence: ${valence}. ` +
        `${explored} elements explored so far. ` +
        `Give a brief, interesting fact about this element or its position in the table.`,
        { silent: true }
      );
    }
  }, [sendText]);

  // Handle category filter click with AI trigger
  const handleCategoryClick = useCallback((cat: string) => {
    const newCategory = hoveredCategory === cat ? (data.focusCategory || null) : cat;
    setHoveredCategory(newCategory);

    if (newCategory && newCategory !== hoveredCategory) {
      sendText(
        `[CATEGORY_EXPLORED] Student clicked the "${cat}" category filter, highlighting all ` +
        `${cat} elements on the table. Briefly describe what makes this family of elements special ` +
        `(shared properties, reactivity, common uses). Keep it to 1-2 sentences.`,
        { silent: true }
      );
    }
  }, [hoveredCategory, data.focusCategory, sendText]);

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
            onClick={() => handleCategoryClick(cat)}
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
          onSelectElement={handleSelectElement}
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
