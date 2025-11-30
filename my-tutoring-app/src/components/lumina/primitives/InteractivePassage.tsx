import React, { useState, useRef } from 'react';
import { InteractivePassageData, PassageSection, VocabularyTerm } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle, HelpCircle, Highlighter, X } from 'lucide-react';

interface InteractivePassageProps {
  data: InteractivePassageData;
  className?: string;
}

const InteractivePassage: React.FC<InteractivePassageProps> = ({ data, className }) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedVocab, setSelectedVocab] = useState<{ term: VocabularyTerm; x: number; y: number } | null>(null);
  const [inlineAnswers, setInlineAnswers] = useState<Record<string, number | null>>({});
  const [selectionStatus, setSelectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showHighlightTask, setShowHighlightTask] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Handle text selection for evidence highlighting
  const handleMouseUp = () => {
    if (!data.highlightTask) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length < 5) return; // Ignore accidental small selections

    // Check if selection matches any target
    const match = data.highlightTask.targets.find(t => 
      selectedText.toLowerCase().includes(t.textSegment.toLowerCase()) || 
      t.textSegment.toLowerCase().includes(selectedText.toLowerCase())
    );

    if (match) {
      if (match.correct) {
        setSelectionStatus('success');
        setFeedbackMessage(match.feedback || "Correct evidence found!");
      } else {
        setSelectionStatus('error');
        setFeedbackMessage(match.feedback || "That's not quite right. Look for evidence that specifically answers the prompt.");
      }
    } else {
      // No specific match found (generic incorrect)
      setSelectionStatus('error');
      setFeedbackMessage("Try again. That doesn't seem to be the right evidence.");
    }

    // Clear selection after a delay if incorrect
    setTimeout(() => {
        if (!match?.correct) {
            selection.removeAllRanges();
            setSelectionStatus('idle');
            setFeedbackMessage(null);
        }
    }, 3000);
  };

  const handleVocabClick = (e: React.MouseEvent, term: VocabularyTerm) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    
    setSelectedVocab({
      term,
      x: rect.left - containerRect.left + (rect.width / 2),
      y: rect.top - containerRect.top
    });
  };

  const handleInlineAnswer = (sectionId: string, optionIndex: number) => {
    setInlineAnswers(prev => ({
      ...prev,
      [sectionId]: optionIndex
    }));
  };

  // Helper to render content with highlighted vocabulary
  const renderSectionContent = (section: PassageSection) => {
    return (
      <div className="relative">
        {section.segments.map((segment, idx) => {
          if (segment.type === 'vocabulary' && segment.vocabData) {
            return (
              <span
                key={idx}
                className="cursor-help border-b-2 border-dashed border-blue-400 text-blue-300 hover:bg-blue-900/30 transition-colors"
                onClick={(e) => handleVocabClick(e, segment.vocabData!)}
              >
                {segment.text}
              </span>
            );
          }
          return <span key={idx}>{segment.text}</span>;
        })}
      </div>
    );
  };

  return (
    <div className={`relative max-w-4xl mx-auto ${className}`} ref={containerRef}>
      {/* Header Info */}
      <div className="mb-8 flex items-center justify-between border-b border-slate-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{data.title}</h2>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            {data.author && <span>By {data.author}</span>}
            {data.readingLevel && (
              <span className="px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">
                {data.readingLevel}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
        </div>
      </div>

      {/* Highlight Task Banner */}
      {data.highlightTask && showHighlightTask && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-4 rounded-xl border ${
            selectionStatus === 'success' ? 'bg-emerald-900/20 border-emerald-500/50' :
            selectionStatus === 'error' ? 'bg-red-900/20 border-red-500/50' :
            'bg-blue-900/20 border-blue-500/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
                selectionStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                selectionStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                'bg-blue-500/20 text-blue-400'
            }`}>
              {selectionStatus === 'success' ? <CheckCircle className="w-5 h-5" /> :
               selectionStatus === 'error' ? <X className="w-5 h-5" /> :
               <Highlighter className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold mb-1 ${
                  selectionStatus === 'success' ? 'text-emerald-400' :
                  selectionStatus === 'error' ? 'text-red-400' :
                  'text-blue-400'
              }`}>
                {selectionStatus === 'success' ? 'Evidence Found!' : 
                 selectionStatus === 'error' ? 'Try Again' : 
                 'Find the Evidence'}
              </h3>
              <p className="text-slate-300 text-sm">
                {feedbackMessage || data.highlightTask.instruction}
              </p>
            </div>
            {selectionStatus === 'success' && (
                <button 
                    onClick={() => setShowHighlightTask(false)}
                    className="text-slate-400 hover:text-white"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div 
        className="space-y-8 font-serif text-lg leading-relaxed text-slate-200"
        onMouseUp={handleMouseUp}
      >
        {data.sections.map((section, idx) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={`relative transition-opacity duration-300 ${
                activeSection && activeSection !== section.id ? 'opacity-40' : 'opacity-100'
            }`}
            onMouseEnter={() => setActiveSection(section.id)}
            onMouseLeave={() => setActiveSection(null)}
          >
            {/* Paragraph Content */}
            <div className="mb-6">
                {renderSectionContent(section)}
            </div>

            {/* Inline Question */}
            {section.inlineQuestion && (
              <div className="my-8 ml-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4 text-purple-400 font-sans text-sm font-bold uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4" />
                  Check Your Understanding
                </div>
                <p className="font-sans text-base font-medium text-white mb-4">
                  {section.inlineQuestion.prompt}
                </p>
                <div className="space-y-2 font-sans text-base">
                  {section.inlineQuestion.options.map((option, optIdx) => {
                    const isSelected = inlineAnswers[section.id] === optIdx;
                    const isCorrect = optIdx === section.inlineQuestion!.correctIndex;
                    const showResult = inlineAnswers[section.id] !== undefined;

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleInlineAnswer(section.id, optIdx)}
                        disabled={showResult && isCorrect}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between ${
                          showResult
                            ? isCorrect
                              ? 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-200'
                              : isSelected
                                ? 'bg-red-900/30 border border-red-500/50 text-red-200'
                                : 'bg-slate-800/50 border border-transparent text-slate-400'
                            : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent hover:border-slate-600 text-slate-200'
                        }`}
                      >
                        <span>{option}</span>
                        {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                        {showResult && isSelected && !isCorrect && <X className="w-5 h-5 text-red-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Vocabulary Tooltip */}
      <AnimatePresence>
        {selectedVocab && (
          <>
            <div 
                className="fixed inset-0 z-40" 
                onClick={() => setSelectedVocab(null)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute z-50 w-64 bg-slate-800 rounded-xl shadow-xl border border-slate-600 p-4"
              style={{
                left: selectedVocab.x,
                top: selectedVocab.y - 10, // Position slightly above
                transform: 'translate(-50%, -100%)'
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-lg font-bold text-white capitalize">
                  {selectedVocab.term.word}
                </h4>
                <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded">
                  {selectedVocab.term.partOfSpeech}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {selectedVocab.term.definition}
              </p>
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-3 h-3 bg-slate-800 border-r border-b border-slate-600"></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractivePassage;