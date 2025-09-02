import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, AlertTriangle, Info, Lightbulb, CheckCircle } from 'lucide-react';

// Type definitions for each primitive
export interface AlertData {
  type: 'alert';
  style: 'info' | 'warning' | 'success' | 'tip';
  title: string;
  content: string;
}

export interface ExpandableData {
  type: 'expandable';
  title: string;
  content: string;
}

export interface QuizData {
  type: 'quiz';
  question: string;
  answer: string;
  explanation?: string;
}

export interface DefinitionData {
  type: 'definition';
  term: string;
  definition: string;
}

export interface ChecklistData {
  type: 'checklist';
  text: string;
  completed?: boolean;
}

export interface TableData {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface KeyValueData {
  type: 'keyvalue';
  key: string;
  value: string;
}

// Alert/Callout Component
export const AlertPrimitive: React.FC<{ data: AlertData }> = ({ data }) => {
  const styles = {
    info: 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 text-blue-900 shadow-blue-100',
    warning: 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300 text-amber-900 shadow-amber-100',
    success: 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-300 text-emerald-900 shadow-emerald-100',
    tip: 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-300 text-purple-900 shadow-purple-100'
  };

  const icons = {
    info: <Info size={18} className="text-blue-600" />,
    warning: <AlertTriangle size={18} className="text-amber-600" />,
    success: <CheckCircle size={18} className="text-emerald-600" />,
    tip: <Lightbulb size={18} className="text-purple-600" />
  };

  return (
    <div className={`border-2 rounded-xl p-5 mb-4 shadow-lg transform hover:scale-[1.01] transition-all duration-200 ${styles[data.style] || styles.info}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 p-1 bg-white rounded-lg shadow-sm">
          {icons[data.style] || icons.info}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold mb-2 text-base">{data.title}</h4>
          <p className="text-sm leading-relaxed">{data.content}</p>
        </div>
      </div>
    </div>
  );
};

// Expandable Section Component
export const ExpandablePrimitive: React.FC<{ data: ExpandableData }> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-2 border-indigo-200 rounded-xl mb-4 bg-gradient-to-r from-indigo-50 to-indigo-100 shadow-lg hover:shadow-xl transition-all duration-300">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-indigo-100 transition-all duration-200 rounded-t-xl"
      >
        <span className="font-semibold text-indigo-900 text-base">{data.title}</span>
        <div className={`transform transition-transform duration-200 p-1 bg-white rounded-lg shadow-sm ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
          <ChevronDown size={16} className="text-indigo-600" />
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-5 pb-4 text-sm text-indigo-800 border-t border-indigo-200 bg-white bg-opacity-50">
          <div className="pt-4 leading-relaxed">{data.content}</div>
        </div>
      )}
    </div>
  );
};

// Quiz Card Component
export const QuizPrimitive: React.FC<{ data: QuizData }> = ({ data }) => {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="border-2 border-cyan-200 rounded-xl p-5 mb-4 bg-gradient-to-br from-cyan-50 to-cyan-100 shadow-lg hover:shadow-xl transition-all duration-300">
      <h4 className="font-semibold text-cyan-900 mb-3 flex items-center text-base">
        <div className="p-2 bg-white rounded-lg shadow-sm mr-3">
          <CheckCircle size={18} className="text-cyan-600" />
        </div>
        Quick Check
      </h4>
      <p className="text-sm text-cyan-800 mb-4 leading-relaxed bg-white bg-opacity-60 p-3 rounded-lg">{data.question}</p>
      
      <button
        onClick={() => setShowAnswer(!showAnswer)}
        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-sm rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 font-medium"
      >
        {showAnswer ? '🙈 Hide Answer' : '👁️ Show Answer'}
      </button>
      
      {showAnswer && (
        <div className="mt-4 p-4 bg-white rounded-lg border-l-4 border-cyan-500 shadow-inner">
          <p className="text-sm font-semibold text-cyan-900 mb-2">✅ {data.answer}</p>
          {data.explanation && (
            <p className="text-xs text-cyan-700 leading-relaxed bg-cyan-50 p-2 rounded">{data.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
};

// Definition Component (inline)
export const DefinitionPrimitive: React.FC<{ data: DefinitionData }> = ({ data }) => {
  const [showDefinition, setShowDefinition] = useState(false);

  return (
    <span className="relative inline">
      <button
        onClick={() => setShowDefinition(!showDefinition)}
        className="text-blue-600 underline decoration-wavy decoration-blue-400 hover:text-blue-800 hover:decoration-blue-600 transition-all duration-200 bg-blue-50 px-1 py-0.5 rounded font-medium hover:bg-blue-100"
      >
        {data.term}
      </button>
      
      {showDefinition && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDefinition(false)}
          />
          <div className="absolute z-20 top-8 left-0 bg-white border-2 border-blue-200 rounded-xl shadow-2xl p-4 w-72 max-w-sm transform transition-all duration-200 scale-100">
            <div className="flex items-start space-x-2 mb-2">
              <div className="p-1 bg-blue-100 rounded-lg">
                <Info size={14} className="text-blue-600" />
              </div>
              <h4 className="font-semibold text-blue-900 text-sm">{data.term}</h4>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">{data.definition}</p>
            <button
              onClick={() => setShowDefinition(false)}
              className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors font-medium"
            >
              Got it! ✓
            </button>
          </div>
        </>
      )}
    </span>
  );
};

// Checklist Item Component
export const ChecklistPrimitive: React.FC<{ 
  data: ChecklistData; 
  onToggle?: () => void; 
}> = ({ data, onToggle }) => {
  const [isCompleted, setIsCompleted] = useState(data.completed || false);

  const handleToggle = () => {
    setIsCompleted(!isCompleted);
    onToggle?.();
  };

  return (
    <div className="flex items-center space-x-4 p-3 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 rounded-xl transition-all duration-200 border border-transparent hover:border-green-200">
      <button
        onClick={handleToggle}
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md ${
          isCompleted 
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-green-500 text-white transform scale-110' 
            : 'border-gray-300 hover:border-green-400 bg-white hover:bg-green-50'
        }`}
      >
        {isCompleted && <Check size={14} className="font-bold" />}
      </button>
      <span className={`text-sm transition-all duration-200 flex-1 ${
        isCompleted ? 'line-through text-gray-500 opacity-75' : 'text-gray-700 font-medium'
      }`}>
        {data.text}
      </span>
      {isCompleted && (
        <span className="text-green-600 text-xs font-medium bg-green-100 px-2 py-1 rounded-full">✓ Done</span>
      )}
    </div>
  );
};

// Simple Table Component
export const TablePrimitive: React.FC<{ data: TableData }> = ({ data }) => {
  return (
    <div className="border-2 border-slate-200 rounded-xl overflow-hidden mb-4 shadow-xl bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-200">
              {data.headers.map((header, index) => (
                <th key={index} className="px-5 py-4 text-left text-sm font-semibold text-slate-800 border-r border-slate-300 last:border-r-0">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50 transition-colors duration-150">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-5 py-3 text-sm text-slate-700 border-r border-slate-100 last:border-r-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Key-Value Component
export const KeyValuePrimitive: React.FC<{ data: KeyValueData }> = ({ data }) => {
  return (
    <div className="flex justify-between items-center p-4 bg-gradient-to-r from-teal-50 to-teal-100 rounded-xl mb-3 hover:from-teal-100 hover:to-teal-150 transition-all duration-200 shadow-md hover:shadow-lg border border-teal-200">
      <span className="text-sm font-semibold text-teal-800 bg-white px-3 py-1 rounded-lg shadow-sm">{data.key}</span>
      <span className="text-sm text-teal-700 font-mono bg-teal-200 px-3 py-1 rounded-lg font-medium">{data.value}</span>
    </div>
  );
};

// Main renderer for all primitives
export type PrimitiveData = AlertData | ExpandableData | QuizData | DefinitionData | ChecklistData | TableData | KeyValueData;

export const ContentPrimitiveRenderer: React.FC<{ data: PrimitiveData; onChecklistToggle?: () => void }> = ({ 
  data, 
  onChecklistToggle 
}) => {
  switch (data.type) {
    case 'alert':
      return <AlertPrimitive data={data} />;
    case 'expandable':
      return <ExpandablePrimitive data={data} />;
    case 'quiz':
      return <QuizPrimitive data={data} />;
    case 'definition':
      return <DefinitionPrimitive data={data} />;
    case 'checklist':
      return <ChecklistPrimitive data={data} onToggle={onChecklistToggle} />;
    case 'table':
      return <TablePrimitive data={data} />;
    case 'keyvalue':
      return <KeyValuePrimitive data={data} />;
    default:
      return null;
  }
};

// Container for multiple primitives of the same type
export const PrimitivesContainer: React.FC<{ 
  primitives: PrimitiveData[]; 
  onChecklistToggle?: (index: number) => void; 
}> = ({ primitives, onChecklistToggle }) => {
  if (!primitives || primitives.length === 0) return null;

  return (
    <div className="space-y-3">
      {primitives.map((primitive, index) => (
        <ContentPrimitiveRenderer 
          key={index} 
          data={primitive} 
          onChecklistToggle={() => onChecklistToggle?.(index)}
        />
      ))}
    </div>
  );
};