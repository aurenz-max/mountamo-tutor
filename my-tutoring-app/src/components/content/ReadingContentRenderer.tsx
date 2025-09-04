import React, { useState } from 'react';
import { 
  AlertPrimitive,
  ExpandablePrimitive,
  QuizPrimitive,
  DefinitionPrimitive,
  ChecklistPrimitive,
  TablePrimitive,
  KeyValuePrimitive,
  InteractiveTimelinePrimitive,
  CarouselPrimitive,
  FlipCardPrimitive,
  CategorizationPrimitive,
  FillInTheBlankPrimitive,
  ScenarioQuestionPrimitive,
  TabbedContentPrimitive,
  MatchingActivityPrimitive,
  SequencingActivityPrimitive,
  AccordionPrimitive,
  PrimitivesContainer,
  PrimitiveData
} from './InteractiveContentPrimitives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageCircle, Sparkles, Eye, Lightbulb, Loader2, X } from 'lucide-react';

// Types for reading content structure - Updated with enhanced primitives
export interface ReadingSection {
  heading: string;
  content: string;
  key_terms_used: string[];
  concepts_covered: string[];
  // Basic Interactive primitives (optional)
  alerts?: Array<{ type: 'alert'; style: 'info' | 'warning' | 'success' | 'tip'; title: string; content: string; }>;
  expandables?: Array<{ type: 'expandable'; title: string; content: string; }>;
  quizzes?: Array<{ type: 'quiz'; question: string; answer: string; explanation?: string; }>;
  definitions?: Array<{ type: 'definition'; term: string; definition: string; }>;
  checklists?: Array<{ type: 'checklist'; text: string; completed?: boolean; }>;
  tables?: Array<{ type: 'table'; headers: string[]; rows: string[][]; }>;
  keyvalues?: Array<{ type: 'keyvalue'; key: string; value: string; }>;
  // New Enhanced Interactive Primitives
  interactive_timelines?: Array<{ type: 'interactive_timeline'; title: string; events: Array<{date: string; title: string; description: string;}> }>;
  carousels?: Array<{ type: 'carousel'; title?: string; items: Array<{image_url: string; alt_text: string; caption?: string; description?: string;}> }>;
  flip_cards?: Array<{ type: 'flip_card'; front_content: string; back_content: string; }>;
  categorization_activities?: Array<{ type: 'categorization'; instruction: string; categories: string[]; items: Array<{item_text: string; correct_category: string;}> }>;
  fill_in_the_blanks?: Array<{ type: 'fill_in_the_blank'; sentence: string; correct_answer: string; hint?: string; }>;
  scenario_questions?: Array<{ type: 'scenario_question'; scenario: string; question: string; answer_options?: string[]; correct_answer: string; explanation: string; }>;
  // New Primitives
  tabbed_content?: Array<{ type: 'tabbed_content'; tabs: Array<{title: string; content: string;}> }>;
  matching_activities?: Array<{ type: 'matching_activity'; instruction: string; pairs: Array<{prompt: string; answer: string;}> }>;
  sequencing_activities?: Array<{ type: 'sequencing_activity'; instruction: string; items: string[]; }>;
  accordions?: Array<{ type: 'accordion'; title?: string; items: Array<{question: string; answer: string;}> }>;
}

export interface ReadingContent {
  title: string;
  sections: ReadingSection[];
  word_count: number;
  reading_level: string;
  grade_appropriate_features: string[];
}

interface ReadingContentRendererProps {
  content: ReadingContent;
  className?: string;
  onAskAI?: (message: string) => void;
  // AI Features props
  discoveryThreads?: {[sectionIndex: number]: {threads: string[]; loading: boolean; error?: string;}};
  visualContent?: {[sectionIndex: number]: {htmlContent: string | null; loading: boolean; error?: string; isOpen: boolean;}};
  onDiscoveryThreadClick?: (sectionIndex: number, threadIndex: number, thread: string) => void;
  onVisualizeClick?: (sectionIndex: number, heading: string, content: string) => void;
  onCloseVisualModal?: (sectionIndex: number) => void;
  subskillId?: string;
}

// Helper function to render content with inline definitions
const renderContentWithDefinitions = (
  content: string, 
  definitions: Array<{ type: 'definition'; term: string; definition: string; }> = []
) => {
  if (!definitions.length) {
    return <p className="text-gray-700 leading-relaxed mb-4">{content}</p>;
  }

  // Simple approach: replace terms with definition components
  let processedContent = content;
  const definitionComponents: React.ReactNode[] = [];
  
  definitions.forEach((def, index) => {
    const termRegex = new RegExp(`\\b${def.term}\\b`, 'gi');
    const matches = content.match(termRegex);
    
    if (matches) {
      const placeholder = `__DEFINITION_${index}__`;
      processedContent = processedContent.replace(termRegex, placeholder);
      definitionComponents[index] = <DefinitionPrimitive key={index} data={def} />;
    }
  });

  // Split content and insert definition components
  const parts = processedContent.split(/(__DEFINITION_\d+__)/);
  
  return (
    <p className="text-gray-700 leading-relaxed mb-4">
      {parts.map((part, index) => {
        const defMatch = part.match(/__DEFINITION_(\d+)__/);
        if (defMatch) {
          const defIndex = parseInt(defMatch[1]);
          return definitionComponents[defIndex] || part;
        }
        return part;
      })}
    </p>
  );
};

export const ReadingContentRenderer: React.FC<ReadingContentRendererProps> = ({ 
  content, 
  className = '',
  onAskAI,
  discoveryThreads,
  visualContent,
  onDiscoveryThreadClick,
  onVisualizeClick,
  onCloseVisualModal,
  subskillId
}) => {
  const [checklistStates, setChecklistStates] = useState<{[sectionIndex: number]: boolean[]}>({});

  const handleChecklistToggle = (sectionIndex: number, checklistIndex: number) => {
    const isCompleting = !checklistStates[sectionIndex]?.[checklistIndex];
    
    setChecklistStates(prev => ({
      ...prev,
      [sectionIndex]: {
        ...prev[sectionIndex],
        [checklistIndex]: !prev[sectionIndex]?.[checklistIndex]
      }
    }));

    // Optional AI integration for checklist completion
    if (isCompleting && onAskAI) {
      const section = content.sections[sectionIndex];
      const checklist = section.checklists?.[checklistIndex];
      if (checklist) {
        onAskAI(`I just completed: "${checklist.text}". Can you give me some encouragement or explain why this step is important for understanding "${section.heading}"?`);
      }
    }
  };

  return (
    <article className={`max-w-4xl mx-auto bg-gray-50 min-h-screen ${className}`}>
      {/* Header */}
      <header className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{content.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>📖 {content.word_count} words</span>
          <span>📊 {content.reading_level}</span>
          <span>⏱️ ~{Math.ceil(content.word_count / 200)} min read</span>
        </div>
      </header>

      {/* Sections */}
      <div className="space-y-8">
        {content.sections.map((section, sectionIndex) => (
          <section key={sectionIndex} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{section.heading}</h2>
            
            {/* Main content with inline definitions */}
            {renderContentWithDefinitions(section.content, section.definitions)}

            {/* Interactive Primitives */}
            <div className="space-y-4 mt-6">
              {/* Alerts */}
              {section.alerts && section.alerts.length > 0 && (
                <div className="space-y-3">
                  {section.alerts.map((alert, index) => (
                    <AlertPrimitive key={`alert-${index}`} data={alert} />
                  ))}
                </div>
              )}

              {/* Expandables */}
              {section.expandables && section.expandables.length > 0 && (
                <div className="space-y-3">
                  {section.expandables.map((expandable, index) => (
                    <ExpandablePrimitive key={`expandable-${index}`} data={expandable} />
                  ))}
                </div>
              )}

              {/* Quizzes */}
              {section.quizzes && section.quizzes.length > 0 && (
                <div className="space-y-3">
                  {section.quizzes.map((quiz, index) => (
                    <QuizPrimitive key={`quiz-${index}`} data={quiz} />
                  ))}
                </div>
              )}

              {/* Checklists */}
              {section.checklists && section.checklists.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3">Progress Checklist</h4>
                  {section.checklists.map((checklist, index) => (
                    <ChecklistPrimitive 
                      key={`checklist-${index}`} 
                      data={{
                        ...checklist,
                        completed: checklistStates[sectionIndex]?.[index] ?? checklist.completed
                      }}
                      onToggle={() => handleChecklistToggle(sectionIndex, index)}
                    />
                  ))}
                </div>
              )}

              {/* Tables */}
              {section.tables && section.tables.length > 0 && (
                <div className="space-y-3">
                  {section.tables.map((table, index) => (
                    <TablePrimitive key={`table-${index}`} data={table} />
                  ))}
                </div>
              )}

              {/* Key-Value Facts */}
              {section.keyvalues && section.keyvalues.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Key Facts</h4>
                  <div className="space-y-2">
                    {section.keyvalues.map((keyvalue, index) => (
                      <KeyValuePrimitive key={`keyvalue-${index}`} data={keyvalue} />
                    ))}
                  </div>
                </div>
              )}

              {/* NEW ENHANCED PRIMITIVES */}

              {/* Interactive Timelines */}
              {section.interactive_timelines && section.interactive_timelines.length > 0 && (
                <div className="space-y-3">
                  {section.interactive_timelines.map((timeline, index) => (
                    <InteractiveTimelinePrimitive key={`timeline-${index}`} data={timeline} />
                  ))}
                </div>
              )}


              {/* Carousels */}
              {section.carousels && section.carousels.length > 0 && (
                <div className="space-y-3">
                  {section.carousels.map((carousel, index) => (
                    <CarouselPrimitive key={`carousel-${index}`} data={carousel} />
                  ))}
                </div>
              )}

              {/* Flip Cards */}
              {section.flip_cards && section.flip_cards.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {section.flip_cards.map((flipcard, index) => (
                    <FlipCardPrimitive key={`flipcard-${index}`} data={flipcard} />
                  ))}
                </div>
              )}

              {/* Categorization Activities */}
              {section.categorization_activities && section.categorization_activities.length > 0 && (
                <div className="space-y-3">
                  {section.categorization_activities.map((categorization, index) => (
                    <CategorizationPrimitive key={`categorization-${index}`} data={categorization} />
                  ))}
                </div>
              )}

              {/* Fill in the Blanks */}
              {section.fill_in_the_blanks && section.fill_in_the_blanks.length > 0 && (
                <div className="space-y-3">
                  {section.fill_in_the_blanks.map((fillBlank, index) => (
                    <FillInTheBlankPrimitive key={`fillblank-${index}`} data={fillBlank} />
                  ))}
                </div>
              )}

              {/* Scenario Questions */}
              {section.scenario_questions && section.scenario_questions.length > 0 && (
                <div className="space-y-3">
                  {section.scenario_questions.map((scenario, index) => (
                    <ScenarioQuestionPrimitive key={`scenario-${index}`} data={scenario} />
                  ))}
                </div>
              )}

              {/* NEW PRIMITIVES */}

              {/* Tabbed Content */}
              {section.tabbed_content && section.tabbed_content.length > 0 && (
                <div className="space-y-3">
                  {section.tabbed_content.map((tabbedContent, index) => (
                    <TabbedContentPrimitive key={`tabbed-${index}`} data={tabbedContent} />
                  ))}
                </div>
              )}

              {/* Matching Activities */}
              {section.matching_activities && section.matching_activities.length > 0 && (
                <div className="space-y-3">
                  {section.matching_activities.map((matchingActivity, index) => (
                    <MatchingActivityPrimitive key={`matching-${index}`} data={matchingActivity} />
                  ))}
                </div>
              )}

              {/* Sequencing Activities */}
              {section.sequencing_activities && section.sequencing_activities.length > 0 && (
                <div className="space-y-3">
                  {section.sequencing_activities.map((sequencingActivity, index) => (
                    <SequencingActivityPrimitive key={`sequencing-${index}`} data={sequencingActivity} />
                  ))}
                </div>
              )}

              {/* Accordions */}
              {section.accordions && section.accordions.length > 0 && (
                <div className="space-y-3">
                  {section.accordions.map((accordion, index) => (
                    <AccordionPrimitive key={`accordion-${index}`} data={accordion} />
                  ))}
                </div>
              )}
            </div>

            {/* Key Terms and Concepts Summary - Hidden for cleaner design */}
            {/* 
            {(section.key_terms_used.length > 0 || section.concepts_covered.length > 0) && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                {section.key_terms_used.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Key Terms:</h4>
                    <div className="flex flex-wrap gap-2">
                      {section.key_terms_used.map((term, index) => (
                        <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {section.concepts_covered.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Concepts Covered:</h4>
                    <div className="flex flex-wrap gap-2">
                      {section.concepts_covered.map((concept, index) => (
                        <span key={index} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            */}

            {/* AI-Assisted Learning Features - Inline with Section */}
            {onAskAI && (
              <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-blue-900 text-base">AI Learning Assistant</h4>
                </div>
                
                {/* Main Action Buttons */}
                <div className="flex gap-3 flex-wrap mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-300 bg-white text-blue-700 hover:bg-blue-100 hover:border-blue-400 text-sm shadow-sm hover:shadow-md transition-all duration-200"
                    onClick={() => onAskAI(`Tell me more about "${section.heading}"`)}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Ask AI about this section
                  </Button>
                  
                  {onVisualizeClick && (
                    <Dialog 
                      open={visualContent?.[sectionIndex]?.isOpen || false}
                      onOpenChange={(open) => {
                        if (!open && onCloseVisualModal) onCloseVisualModal(sectionIndex);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-purple-300 bg-white text-purple-700 hover:bg-purple-100 hover:border-purple-400 text-sm shadow-sm hover:shadow-md transition-all duration-200"
                          onClick={() => onVisualizeClick(sectionIndex, section.heading, section.content)}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Visual Demo
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Interactive Demo: {section.heading}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                          {visualContent?.[sectionIndex]?.loading && (
                            <div className="flex flex-col items-center justify-center py-12">
                              <Loader2 className="w-8 h-8 mb-4 animate-spin text-purple-600" />
                              <p className="text-sm text-muted-foreground">Generating interactive demonstration...</p>
                            </div>
                          )}
                          
                          {visualContent?.[sectionIndex]?.error && (
                            <div className="text-center py-12">
                              <div className="text-red-600 mb-4">{visualContent[sectionIndex]?.error}</div>
                              <Button 
                                variant="outline" 
                                onClick={() => onVisualizeClick && onVisualizeClick(sectionIndex, section.heading, section.content)}
                              >
                                Try Again
                              </Button>
                            </div>
                          )}
                          
                          {visualContent?.[sectionIndex]?.htmlContent && (
                            <div className="space-y-4">
                              <iframe
                                srcDoc={visualContent[sectionIndex]?.htmlContent || ''}
                                sandbox="allow-scripts"
                                className="w-full h-[500px] border border-gray-200 rounded-lg"
                                title={`Interactive Demo for ${section.heading}`}
                              />
                              
                              {/* AI Walkthrough Threads */}
                              <div className="border-t pt-4">
                                <h4 className="text-sm font-medium text-gray-700 flex items-center mb-3">
                                  <MessageCircle className="w-4 h-4 mr-2" />
                                  Ask AI to walk you through this visual:
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <Button
                                    variant="ghost"
                                    className="justify-start text-left h-auto py-3 px-3 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-colors"
                                    onClick={() => onAskAI(`Walk me through this visual demonstration of "${section.heading}" step by step`)}
                                  >
                                    <span className="whitespace-normal text-sm">Walk me through this step by step</span>
                                  </Button>
                                  
                                  <Button
                                    variant="ghost"
                                    className="justify-start text-left h-auto py-3 px-3 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-colors"
                                    onClick={() => onAskAI(`Explain what I should focus on in this visual demonstration of "${section.heading}"`)}
                                  >
                                    <span className="whitespace-normal text-sm">What should I focus on here?</span>
                                  </Button>
                                  
                                  <Button
                                    variant="ghost"
                                    className="justify-start text-left h-auto py-3 px-3 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-colors"
                                    onClick={() => onAskAI(`How does this visual help me understand the concept of "${section.heading}"?`)}
                                  >
                                    <span className="whitespace-normal text-sm">How does this help me understand?</span>
                                  </Button>
                                  
                                  <Button
                                    variant="ghost"
                                    className="justify-start text-left h-auto py-3 px-3 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-colors"
                                    onClick={() => onAskAI(`Can you guide me through interacting with this visual demonstration of "${section.heading}"?`)}
                                  >
                                    <span className="whitespace-normal text-sm">Guide me through the interaction</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {/* Discovery Threads Section */}
                {discoveryThreads?.[sectionIndex] && (
                  <div className="space-y-3">
                    {discoveryThreads[sectionIndex].loading && !discoveryThreads[sectionIndex].threads.length ? (
                      <div className="flex items-center py-2">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span className="text-sm text-muted-foreground">Generating discovery questions...</span>
                      </div>
                    ) : discoveryThreads[sectionIndex].threads.length > 0 ? (
                      <>
                        <h4 className="text-sm font-medium text-gray-700 flex items-center">
                          <Lightbulb className="w-4 h-4 mr-2" />
                          Discover More:
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {discoveryThreads[sectionIndex].threads.map((thread, threadIndex) => (
                            <Button
                              key={`${sectionIndex}-${threadIndex}-${thread.substring(0, 20)}`}
                              variant="ghost"
                              className="justify-start text-left h-auto py-2 px-3 border border-blue-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-xs"
                              onClick={() => onDiscoveryThreadClick && onDiscoveryThreadClick(sectionIndex, threadIndex, thread)}
                              disabled={discoveryThreads[sectionIndex].loading}
                            >
                              {discoveryThreads[sectionIndex].loading ? (
                                <div className="flex items-center">
                                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  <span className="whitespace-normal opacity-50">{thread}</span>
                                </div>
                              ) : (
                                <span className="whitespace-normal">{thread}</span>
                              )}
                            </Button>
                          ))}
                        </div>
                        {discoveryThreads[sectionIndex].loading && (
                          <p className="text-xs text-gray-500 italic">Click a question to ask the AI tutor and get a new question...</p>
                        )}
                      </>
                    ) : discoveryThreads[sectionIndex].error ? (
                      <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-600">{discoveryThreads[sectionIndex].error}</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {/* Would need a retry handler */}}
                        >
                          Try Again
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Grade-Appropriate Features:</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            {content.grade_appropriate_features.map((feature, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-500 mr-2 text-base">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </article>
  );
};