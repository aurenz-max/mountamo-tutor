import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, AlertTriangle, Info, Lightbulb, CheckCircle, Clock, Image, ArrowLeft, ArrowRight, RotateCcw, Move } from 'lucide-react';

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

// New Enhanced Primitives Type Definitions
export interface InteractiveTimelineData {
  type: 'interactive_timeline';
  title: string;
  events: Array<{
    date: string;
    title: string;
    description: string;
  }>;
}


export interface CarouselData {
  type: 'carousel';
  title?: string;
  items: Array<{
    image_url: string;
    alt_text: string;
    caption?: string;
    description?: string;
  }>;
}

export interface FlipCardData {
  type: 'flip_card';
  front_content: string;
  back_content: string;
}

export interface CategorizationData {
  type: 'categorization';
  instruction: string;
  categories: string[];
  items: Array<{
    item_text: string;
    correct_category: string;
  }>;
}

export interface FillInTheBlankData {
  type: 'fill_in_the_blank';
  sentence: string;
  correct_answer: string;
  hint?: string;
}

export interface ScenarioQuestionData {
  type: 'scenario_question';
  scenario: string;
  question: string;
  answer_options?: string[];
  correct_answer: string;
  explanation: string;
}

// New Primitives Type Definitions
export interface TabbedContentData {
  type: 'tabbed_content';
  tabs: Array<{
    title: string;
    content: string;
  }>;
}

export interface MatchingActivityData {
  type: 'matching_activity';
  instruction: string;
  pairs: Array<{
    prompt: string;
    answer: string;
  }>;
}

export interface SequencingActivityData {
  type: 'sequencing_activity';
  instruction: string;
  items: string[];
}

export interface AccordionData {
  type: 'accordion';
  title?: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
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

// NEW ENHANCED PRIMITIVES

// Interactive Timeline Component
export const InteractiveTimelinePrimitive: React.FC<{ data: InteractiveTimelineData }> = ({ data }) => {
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);

  return (
    <div className="border-2 border-rose-200 rounded-xl p-6 mb-4 bg-gradient-to-br from-rose-50 to-pink-100 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Clock className="w-5 h-5 text-rose-600" />
        </div>
        <h4 className="font-bold text-rose-900 text-lg">{data.title}</h4>
      </div>
      
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-400 to-rose-600 rounded-full"></div>
        
        <div className="space-y-6">
          {data.events.map((event, index) => (
            <div 
              key={index} 
              className="relative flex items-start cursor-pointer group"
              onClick={() => setSelectedEvent(selectedEvent === index ? null : index)}
            >
              {/* Timeline Node */}
              <div className={`relative z-10 w-6 h-6 rounded-full border-4 transition-all duration-300 ${
                selectedEvent === index 
                  ? 'bg-rose-500 border-white scale-125 shadow-lg' 
                  : 'bg-white border-rose-400 group-hover:border-rose-500 group-hover:scale-110'
              }`}>
                {selectedEvent === index && (
                  <div className="absolute inset-0 bg-rose-500 rounded-full animate-pulse"></div>
                )}
              </div>
              
              {/* Event Content */}
              <div className={`ml-6 flex-1 transition-all duration-300 ${
                selectedEvent === index ? 'transform scale-105' : ''
              }`}>
                <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  selectedEvent === index
                    ? 'bg-white border-rose-300 shadow-xl'
                    : 'bg-rose-50 border-rose-200 group-hover:border-rose-300 group-hover:shadow-md'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-rose-700 bg-rose-200 px-2 py-1 rounded-full">
                      {event.date}
                    </span>
                  </div>
                  <h5 className="font-semibold text-rose-900 mb-2">{event.title}</h5>
                  
                  {selectedEvent === index && (
                    <div className="mt-3 p-3 bg-rose-100 rounded-lg animate-in slide-in-from-top-2 duration-300">
                      <p className="text-sm text-rose-800 leading-relaxed">{event.description}</p>
                    </div>
                  )}
                  
                  {selectedEvent !== index && (
                    <p className="text-xs text-rose-600">Click to learn more...</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


// Carousel Component - Modified for text-based step-by-step instructions
export const CarouselPrimitive: React.FC<{ data: CarouselData }> = ({ data }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % data.items.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + data.items.length) % data.items.length);
  };

  const currentItem = data.items[currentIndex];

  return (
    <div className="border-2 border-emerald-200 rounded-xl p-6 mb-4 bg-gradient-to-br from-emerald-50 to-green-100 shadow-lg">
      {data.title && (
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <ArrowRight className="w-5 h-5 text-emerald-600" />
          </div>
          <h4 className="font-bold text-emerald-900 text-lg">{data.title}</h4>
        </div>
      )}
      
      <div className="relative">
        <div className="bg-white rounded-lg p-6 shadow-md min-h-[200px] flex items-center justify-center">
          <div className="text-center max-w-md">
            {/* Step Number */}
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              {currentIndex + 1}
            </div>
            
            {/* Step Content */}
            {currentItem.caption && (
              <h5 className="font-bold text-emerald-900 mb-4 text-lg">{currentItem.caption}</h5>
            )}
            
            <p className="text-gray-700 leading-relaxed text-base">
              {currentItem.description || currentItem.alt_text || "Step description"}
            </p>
          </div>
        </div>
        
        {/* Navigation */}
        {data.items.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-md hover:shadow-lg transition-all duration-200"
              disabled={currentIndex === 0}
            >
              <ArrowLeft className={`w-5 h-5 ${currentIndex === 0 ? 'text-gray-400' : 'text-emerald-600'}`} />
            </button>
            
            <button
              onClick={nextSlide}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-md hover:shadow-lg transition-all duration-200"
              disabled={currentIndex === data.items.length - 1}
            >
              <ArrowRight className={`w-5 h-5 ${currentIndex === data.items.length - 1 ? 'text-gray-400' : 'text-emerald-600'}`} />
            </button>
          </>
        )}
        
        {/* Progress indicator */}
        {data.items.length > 1 && (
          <div className="mt-4">
            {/* Step indicators */}
            <div className="flex justify-center gap-2 mb-2">
              {data.items.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    index === currentIndex
                      ? 'bg-emerald-500 scale-125'
                      : index < currentIndex
                        ? 'bg-emerald-300'
                        : 'bg-emerald-200 hover:bg-emerald-300'
                  }`}
                />
              ))}
            </div>
            
            {/* Progress text */}
            <div className="text-center text-sm text-emerald-700">
              Step {currentIndex + 1} of {data.items.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Flip Card Component - Fixed with simpler implementation
export const FlipCardPrimitive: React.FC<{ data: FlipCardData }> = ({ data }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="border-2 border-orange-200 rounded-xl p-6 mb-4 bg-gradient-to-br from-orange-50 to-amber-100 shadow-lg">
      <div 
        className="relative w-full h-48 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {!isFlipped ? (
          /* Front Face */
          <div className="absolute inset-0 bg-white rounded-lg shadow-md border-2 border-orange-300 flex items-center justify-center p-6 transition-all duration-300">
            <div className="text-center">
              <RotateCcw className="w-8 h-8 text-orange-500 mx-auto mb-4" />
              <p className="text-orange-900 font-medium leading-relaxed">{data.front_content}</p>
              <p className="text-xs text-orange-600 mt-4">Click to flip →</p>
            </div>
          </div>
        ) : (
          /* Back Face */
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg shadow-md border-2 border-orange-600 flex items-center justify-center p-6 transition-all duration-300">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-white mx-auto mb-4" />
              <p className="text-white font-medium leading-relaxed">{data.back_content}</p>
              <p className="text-xs text-orange-100 mt-4">← Click to flip back</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Categorization Activity Component
export const CategorizationPrimitive: React.FC<{ data: CategorizationData }> = ({ data }) => {
  const [userAnswers, setUserAnswers] = useState<{[key: string]: string}>({});
  const [showResults, setShowResults] = useState(false);

  const handleDrop = (itemText: string, category: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [itemText]: category
    }));
  };

  const checkAnswers = () => {
    setShowResults(true);
  };

  const resetActivity = () => {
    setUserAnswers({});
    setShowResults(false);
  };

  return (
    <div className="border-2 border-indigo-200 rounded-xl p-6 mb-4 bg-gradient-to-br from-indigo-50 to-blue-100 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Move className="w-5 h-5 text-indigo-600" />
        </div>
        <h4 className="font-bold text-indigo-900 text-lg">Categorization Activity</h4>
      </div>
      
      <p className="text-indigo-800 mb-6 bg-white/60 p-3 rounded-lg">{data.instruction}</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories */}
        <div className="space-y-4">
          <h5 className="font-semibold text-indigo-900">Categories:</h5>
          {data.categories.map((category) => (
            <div
              key={category}
              className="bg-white border-2 border-indigo-200 rounded-lg p-4 min-h-[120px] shadow-sm"
            >
              <h6 className="font-medium text-indigo-800 mb-3 text-center">{category}</h6>
              <div className="space-y-2">
                {Object.entries(userAnswers)
                  .filter(([_, assignedCategory]) => assignedCategory === category)
                  .map(([itemText]) => {
                    const item = data.items.find(i => i.item_text === itemText);
                    const isCorrect = item?.correct_category === category;
                    return (
                      <div
                        key={itemText}
                        className={`p-2 rounded text-sm text-center transition-all duration-200 ${
                          showResults
                            ? isCorrect
                              ? 'bg-green-100 border-2 border-green-300 text-green-800'
                              : 'bg-red-100 border-2 border-red-300 text-red-800'
                            : 'bg-indigo-100 border border-indigo-300 text-indigo-700'
                        }`}
                      >
                        {itemText}
                        {showResults && (isCorrect ? ' ✓' : ' ✗')}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Items to categorize */}
        <div className="space-y-4">
          <h5 className="font-semibold text-indigo-900">Items to categorize:</h5>
          <div className="grid grid-cols-1 gap-3">
            {data.items
              .filter(item => !userAnswers[item.item_text])
              .map((item) => (
                <div
                  key={item.item_text}
                  className="bg-white border-2 border-gray-300 rounded-lg p-3 cursor-move hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                >
                  <p className="text-sm text-gray-700 text-center font-medium">{item.item_text}</p>
                  <div className="flex gap-2 mt-2">
                    {data.categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => handleDrop(item.item_text, category)}
                        className="flex-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded transition-colors"
                      >
                        → {category}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={checkAnswers}
              disabled={Object.keys(userAnswers).length !== data.items.length}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
            >
              Check Answers
            </button>
            <button
              onClick={resetActivity}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Fill in the Blank Component
export const FillInTheBlankPrimitive: React.FC<{ data: FillInTheBlankData }> = ({ data }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const checkAnswer = () => {
    setShowResult(true);
  };

  const resetQuestion = () => {
    setUserAnswer('');
    setShowResult(false);
    setShowHint(false);
  };

  const isCorrect = userAnswer.toLowerCase().trim() === data.correct_answer.toLowerCase().trim();

  // Split sentence on blank placeholder
  const parts = data.sentence.split('__');

  return (
    <div className="border-2 border-yellow-200 rounded-xl p-6 mb-4 bg-gradient-to-br from-yellow-50 to-amber-100 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <CheckCircle className="w-5 h-5 text-yellow-600" />
        </div>
        <h4 className="font-bold text-yellow-900 text-lg">Fill in the Blank</h4>
      </div>
      
      <div className="bg-white/60 p-4 rounded-lg mb-4">
        <div className="text-lg text-gray-800 leading-relaxed">
          {parts.map((part, index) => (
            <span key={index}>
              {part}
              {index < parts.length - 1 && (
                showResult ? (
                  <span className={`inline-block min-w-[120px] px-3 py-1 mx-1 rounded font-semibold ${
                    isCorrect 
                      ? 'bg-green-100 border-2 border-green-300 text-green-800'
                      : 'bg-red-100 border-2 border-red-300 text-red-800'
                  }`}>
                    {userAnswer || '___'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="inline-block min-w-[120px] px-3 py-1 mx-1 border-2 border-yellow-300 rounded text-center focus:border-yellow-500 focus:outline-none"
                    placeholder="___"
                  />
                )
              )}
            </span>
          ))}
        </div>
      </div>
      
      {showResult && (
        <div className={`p-4 rounded-lg mb-4 ${
          isCorrect 
            ? 'bg-green-100 border-2 border-green-300' 
            : 'bg-red-100 border-2 border-red-300'
        }`}>
          <p className={`font-semibold mb-2 ${
            isCorrect ? 'text-green-800' : 'text-red-800'
          }`}>
            {isCorrect ? '✅ Correct!' : '❌ Not quite right'}
          </p>
          {!isCorrect && (
            <p className="text-red-700 text-sm">
              The correct answer is: <strong>{data.correct_answer}</strong>
            </p>
          )}
        </div>
      )}
      
      <div className="flex gap-3">
        {!showResult ? (
          <>
            <button
              onClick={checkAnswer}
              disabled={!userAnswer.trim()}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
            >
              Check Answer
            </button>
            {data.hint && (
              <button
                onClick={() => setShowHint(!showHint)}
                className="bg-yellow-200 hover:bg-yellow-300 text-yellow-800 px-4 py-2 rounded-lg font-medium transition-all duration-200"
              >
                {showHint ? 'Hide Hint' : 'Show Hint'}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={resetQuestion}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
          >
            Try Again
          </button>
        )}
      </div>
      
      {showHint && data.hint && (
        <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-400 rounded">
          <p className="text-sm text-yellow-800">
            <Lightbulb className="w-4 h-4 inline mr-2" />
            <strong>Hint:</strong> {data.hint}
          </p>
        </div>
      )}
    </div>
  );
};

// Scenario Question Component
export const ScenarioQuestionPrimitive: React.FC<{ data: ScenarioQuestionData }> = ({ data }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showResult, setShowResult] = useState(false);

  const handleSubmit = () => {
    setShowResult(true);
  };

  const resetQuestion = () => {
    setSelectedAnswer('');
    setShowResult(false);
  };

  const isCorrect = selectedAnswer === data.correct_answer;

  return (
    <div className="border-2 border-purple-200 rounded-xl p-6 mb-4 bg-gradient-to-br from-purple-50 to-violet-100 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Lightbulb className="w-5 h-5 text-purple-600" />
        </div>
        <h4 className="font-bold text-purple-900 text-lg">Scenario Challenge</h4>
      </div>
      
      <div className="bg-white/60 p-4 rounded-lg mb-4">
        <h5 className="font-semibold text-purple-900 mb-3">Scenario:</h5>
        <p className="text-gray-800 leading-relaxed mb-4">{data.scenario}</p>
        
        <h5 className="font-semibold text-purple-900 mb-3">Question:</h5>
        <p className="text-gray-800 leading-relaxed">{data.question}</p>
      </div>
      
      {data.answer_options ? (
        <div className="space-y-3 mb-4">
          {data.answer_options.map((option, index) => (
            <button
              key={index}
              onClick={() => !showResult && setSelectedAnswer(option)}
              disabled={showResult}
              className={`w-full p-3 text-left rounded-lg border-2 transition-all duration-200 ${
                showResult
                  ? option === data.correct_answer
                    ? 'bg-green-100 border-green-300 text-green-800'
                    : selectedAnswer === option
                      ? 'bg-red-100 border-red-300 text-red-800'
                      : 'bg-gray-100 border-gray-300 text-gray-600'
                  : selectedAnswer === option
                    ? 'bg-purple-100 border-purple-300 text-purple-800'
                    : 'bg-white border-purple-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <span className="font-medium text-sm">
                {String.fromCharCode(65 + index)}.
              </span> {option}
              {showResult && option === data.correct_answer && ' ✓'}
              {showResult && selectedAnswer === option && option !== data.correct_answer && ' ✗'}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-4">
          <textarea
            value={selectedAnswer}
            onChange={(e) => setSelectedAnswer(e.target.value)}
            disabled={showResult}
            className="w-full p-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
            rows={3}
            placeholder="Type your answer here..."
          />
        </div>
      )}
      
      {showResult && (
        <div className={`p-4 rounded-lg mb-4 ${
          isCorrect 
            ? 'bg-green-100 border-2 border-green-300' 
            : 'bg-red-100 border-2 border-red-300'
        }`}>
          <p className={`font-semibold mb-2 ${
            isCorrect ? 'text-green-800' : 'text-red-800'
          }`}>
            {isCorrect ? '✅ Excellent reasoning!' : '❌ Let\'s explore this together'}
          </p>
          <p className="text-sm leading-relaxed text-gray-700">
            <strong>Explanation:</strong> {data.explanation}
          </p>
        </div>
      )}
      
      <div className="flex gap-3">
        {!showResult ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedAnswer.trim()}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={resetQuestion}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// Tabbed Content Component
export const TabbedContentPrimitive: React.FC<{ data: TabbedContentData }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="border-2 border-slate-200 rounded-xl mb-4 bg-white shadow-lg">
      {/* Tab Headers */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex flex-wrap">
          {data.tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-6 py-4 text-sm font-medium transition-all duration-200 border-b-2 ${
                activeTab === index
                  ? 'border-blue-500 text-blue-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="p-6">
        <div className="transition-all duration-300 ease-in-out">
          <div className="text-gray-700 leading-relaxed">
            {data.tabs[activeTab]?.content}
          </div>
        </div>
      </div>
    </div>
  );
};

// Matching Activity Component
export const MatchingActivityPrimitive: React.FC<{ data: MatchingActivityData }> = ({ data }) => {
  const [userMatches, setUserMatches] = useState<{[key: string]: string}>({});
  const [showResults, setShowResults] = useState(false);

  // Shuffle the answers for display
  const [shuffledAnswers] = useState(() => {
    const answers = data.pairs.map(pair => pair.answer);
    return answers.sort(() => Math.random() - 0.5);
  });

  const handleMatch = (prompt: string, answer: string) => {
    setUserMatches(prev => ({
      ...prev,
      [prompt]: answer
    }));
  };

  const removeMatch = (prompt: string) => {
    setUserMatches(prev => {
      const newMatches = { ...prev };
      delete newMatches[prompt];
      return newMatches;
    });
  };

  const checkAnswers = () => {
    setShowResults(true);
  };

  const resetActivity = () => {
    setUserMatches({});
    setShowResults(false);
  };

  return (
    <div className="border-2 border-green-200 rounded-xl p-6 mb-4 bg-gradient-to-br from-green-50 to-emerald-100 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Move className="w-5 h-5 text-green-600" />
        </div>
        <h4 className="font-bold text-green-900 text-lg">Matching Activity</h4>
      </div>
      
      <p className="text-green-800 mb-6 bg-white/60 p-3 rounded-lg">{data.instruction}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prompts Column */}
        <div className="space-y-3">
          <h5 className="font-semibold text-green-900 mb-3">Match these:</h5>
          {data.pairs.map((pair, index) => {
            const userAnswer = userMatches[pair.prompt];
            const correctAnswer = pair.answer;
            const isCorrect = userAnswer === correctAnswer;
            
            return (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  showResults && userAnswer
                    ? isCorrect
                      ? 'bg-green-100 border-green-300'
                      : 'bg-red-100 border-red-300'
                    : 'bg-white border-green-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-800">{pair.prompt}</span>
                  {showResults && userAnswer && (
                    <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                      {isCorrect ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                {userAnswer && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-sm px-3 py-1 rounded-full ${
                      showResults && isCorrect 
                        ? 'bg-green-200 text-green-800' 
                        : showResults 
                          ? 'bg-red-200 text-red-800'
                          : 'bg-green-200 text-green-800'
                    }`}>
                      {userAnswer}
                    </span>
                    {!showResults && (
                      <button
                        onClick={() => removeMatch(pair.prompt)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Answers Column */}
        <div className="space-y-3">
          <h5 className="font-semibold text-green-900 mb-3">With these:</h5>
          {shuffledAnswers.map((answer, index) => {
            const isUsed = Object.values(userMatches).includes(answer);
            
            return (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  isUsed ? 'bg-gray-100 border-gray-300 opacity-50' : 'bg-white border-green-200 hover:border-green-300 cursor-pointer'
                }`}
              >
                <span className="text-sm text-green-800">{answer}</span>
                {!isUsed && !showResults && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.pairs.map((pair, pairIndex) => {
                      if (userMatches[pair.prompt]) return null;
                      return (
                        <button
                          key={pairIndex}
                          onClick={() => handleMatch(pair.prompt, answer)}
                          className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded transition-colors"
                        >
                          → {pair.prompt.length > 20 ? pair.prompt.substring(0, 20) + '...' : pair.prompt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex gap-3 mt-6">
        <button
          onClick={checkAnswers}
          disabled={Object.keys(userMatches).length !== data.pairs.length}
          className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
        >
          Check Matches
        </button>
        <button
          onClick={resetActivity}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
        >
          Reset
        </button>
      </div>
      
      {showResults && (
        <div className="mt-4 p-4 bg-white rounded-lg border-l-4 border-green-500">
          <p className="text-sm text-green-800">
            <strong>Results:</strong> {Object.keys(userMatches).filter(prompt => {
              const correctAnswer = data.pairs.find(p => p.prompt === prompt)?.answer;
              return userMatches[prompt] === correctAnswer;
            }).length} out of {data.pairs.length} correct
          </p>
        </div>
      )}
    </div>
  );
};

// Sequencing Activity Component
export const SequencingActivityPrimitive: React.FC<{ data: SequencingActivityData }> = ({ data }) => {
  const [shuffledItems, setShuffledItems] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Initialize shuffled items on mount
  React.useEffect(() => {
    setShuffledItems([...data.items].sort(() => Math.random() - 0.5));
  }, [data.items]);

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (showResults) return;
    
    const newItems = [...shuffledItems];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    setShuffledItems(newItems);
  };

  const checkOrder = () => {
    setShowResults(true);
  };

  const resetActivity = () => {
    setShuffledItems([...data.items].sort(() => Math.random() - 0.5));
    setShowResults(false);
  };

  const isCorrectOrder = JSON.stringify(shuffledItems) === JSON.stringify(data.items);

  return (
    <div className="border-2 border-orange-200 rounded-xl p-6 mb-4 bg-gradient-to-br from-orange-50 to-amber-100 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <ArrowRight className="w-5 h-5 text-orange-600" />
        </div>
        <h4 className="font-bold text-orange-900 text-lg">Sequencing Activity</h4>
      </div>
      
      <p className="text-orange-800 mb-6 bg-white/60 p-3 rounded-lg">{data.instruction}</p>
      
      <div className="space-y-3 mb-6">
        {shuffledItems.map((item, index) => {
          const correctIndex = data.items.indexOf(item);
          const isInCorrectPosition = showResults && index === correctIndex;
          
          return (
            <div
              key={`${item}-${index}`}
              className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center justify-between ${
                showResults
                  ? isInCorrectPosition
                    ? 'bg-green-100 border-green-300'
                    : 'bg-red-100 border-red-300'
                  : 'bg-white border-orange-200 hover:border-orange-300'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  showResults && isInCorrectPosition
                    ? 'bg-green-500 text-white'
                    : showResults
                      ? 'bg-red-500 text-white'
                      : 'bg-orange-200 text-orange-800'
                }`}>
                  {index + 1}
                </span>
                <span className="text-sm text-gray-800">{item}</span>
              </div>
              
              {!showResults && (
                <div className="flex gap-2">
                  <button
                    onClick={() => moveItem(index, Math.max(0, index - 1))}
                    disabled={index === 0}
                    className="p-1 bg-orange-200 hover:bg-orange-300 disabled:opacity-50 rounded text-orange-800 transition-colors"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveItem(index, Math.min(shuffledItems.length - 1, index + 1))}
                    disabled={index === shuffledItems.length - 1}
                    className="p-1 bg-orange-200 hover:bg-orange-300 disabled:opacity-50 rounded text-orange-800 transition-colors"
                  >
                    ↓
                  </button>
                </div>
              )}
              
              {showResults && (
                <span className={isInCorrectPosition ? 'text-green-600' : 'text-red-600'}>
                  {isInCorrectPosition ? '✓' : `✗ (should be #${correctIndex + 1})`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex gap-3">
        {!showResults ? (
          <button
            onClick={checkOrder}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
          >
            Check Order
          </button>
        ) : (
          <button
            onClick={resetActivity}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
          >
            Try Again
          </button>
        )}
      </div>
      
      {showResults && (
        <div className={`mt-4 p-4 rounded-lg ${
          isCorrectOrder ? 'bg-green-100 border-l-4 border-green-500' : 'bg-red-100 border-l-4 border-red-500'
        }`}>
          <p className={`text-sm font-semibold ${isCorrectOrder ? 'text-green-800' : 'text-red-800'}`}>
            {isCorrectOrder ? '✅ Perfect! You got the correct sequence!' : '❌ Not quite right. Try rearranging the items.'}
          </p>
        </div>
      )}
    </div>
  );
};

// Accordion Component
export const AccordionPrimitive: React.FC<{ data: AccordionData }> = ({ data }) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="border-2 border-blue-200 rounded-xl mb-4 bg-gradient-to-r from-blue-50 to-indigo-100 shadow-lg">
      {data.title && (
        <div className="px-6 py-4 border-b border-blue-200 bg-gradient-to-r from-blue-100 to-indigo-200">
          <h4 className="font-bold text-blue-900 text-lg">{data.title}</h4>
        </div>
      )}
      
      <div className="divide-y divide-blue-200">
        {data.items.map((item, index) => (
          <div key={index} className="transition-all duration-200">
            <button
              onClick={() => toggleItem(index)}
              className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-blue-100 transition-all duration-200"
            >
              <span className="font-semibold text-blue-900 text-base pr-4">{item.question}</span>
              <div className={`transform transition-transform duration-200 p-1 bg-white rounded-lg shadow-sm ${
                expandedItems.has(index) ? 'rotate-180' : ''
              }`}>
                <ChevronDown size={16} className="text-blue-600" />
              </div>
            </button>
            
            {expandedItems.has(index) && (
              <div className="px-6 pb-4 text-sm text-blue-800 bg-white bg-opacity-50 border-t border-blue-200">
                <div className="pt-4 leading-relaxed">{item.answer}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Main renderer for all primitives - Updated with new enhanced primitives (removed image hotspots)
export type PrimitiveData = AlertData | ExpandableData | QuizData | DefinitionData | ChecklistData | TableData | KeyValueData | 
  InteractiveTimelineData | CarouselData | FlipCardData | CategorizationData | FillInTheBlankData | ScenarioQuestionData |
  TabbedContentData | MatchingActivityData | SequencingActivityData | AccordionData;

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
    // New Enhanced Primitives
    case 'interactive_timeline':
      return <InteractiveTimelinePrimitive data={data} />;
    case 'carousel':
      return <CarouselPrimitive data={data} />;
    case 'flip_card':
      return <FlipCardPrimitive data={data} />;
    case 'categorization':
      return <CategorizationPrimitive data={data} />;
    case 'fill_in_the_blank':
      return <FillInTheBlankPrimitive data={data} />;
    case 'scenario_question':
      return <ScenarioQuestionPrimitive data={data} />;
    // New Primitives
    case 'tabbed_content':
      return <TabbedContentPrimitive data={data} />;
    case 'matching_activity':
      return <MatchingActivityPrimitive data={data} />;
    case 'sequencing_activity':
      return <SequencingActivityPrimitive data={data} />;
    case 'accordion':
      return <AccordionPrimitive data={data} />;
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