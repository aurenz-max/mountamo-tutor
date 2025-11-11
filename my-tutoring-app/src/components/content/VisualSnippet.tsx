import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Eye, Lightbulb, ChevronDown, Play, CheckCircle2, Maximize2, Minimize2, MessageCircle } from 'lucide-react';
import { VisualMetadata } from '@/lib/packages/types';

interface VisualSnippetProps {
  sectionHeading: string;
  visualHtml: string;
  visualMetadata?: VisualMetadata;
  isCompleted?: boolean;
  onComplete?: () => void;
  onAskAI?: (message: string) => void;
}

export function VisualSnippet({
  sectionHeading,
  visualHtml,
  visualMetadata,
  isCompleted = false,
  onComplete,
  onAskAI,
}: VisualSnippetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasMarkedComplete = useRef(false);

  // Mark as completed when user expands the visual (higher engagement weight)
  useEffect(() => {
    if (isExpanded && !hasMarkedComplete.current && onComplete) {
      onComplete();
      hasMarkedComplete.current = true;
    }
  }, [isExpanded, onComplete]);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    setIsTheaterMode(false);
    setShowGuidance(false);
  };

  const toggleTheaterMode = () => {
    setIsTheaterMode(!isTheaterMode);
  };

  // Generate preview thumbnail from iframe content
  const renderThumbnail = () => {
    return (
      <div className="relative group cursor-pointer" onClick={handleExpand}>
        {/* Preview container with play overlay */}
        <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-blue-200 rounded-lg p-8 hover:border-blue-400 transition-all">
          <div className="absolute inset-0 bg-black/5 group-hover:bg-black/10 transition-all rounded-lg" />

          {/* Play button overlay */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-blue-600 group-hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition-all group-hover:scale-110">
              <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Interactive Visual</p>
              <p className="text-sm text-gray-600 mt-1">Click to explore</p>
            </div>
          </div>

          {/* Completion badge */}
          {isCompleted && (
            <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-md">
              <CheckCircle2 className="w-3 h-3" />
              Viewed
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGuidanceCards = () => {
    // Fallback to generic AI prompts if no metadata
    if (!visualMetadata && onAskAI) {
      return (
        <Collapsible open={showGuidance} onOpenChange={setShowGuidance}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <ChevronDown className={`w-4 h-4 mr-2 transition-transform ${showGuidance ? 'rotate-180' : ''}`} />
              {showGuidance ? 'Hide' : 'Show'} Learning Guide
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onAskAI(`Walk me through the visual content in "${sectionHeading}" step by step, as if you were my teacher.`)}
              >
                <Eye className="w-4 h-4 mr-2" /> Walk me through this
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onAskAI(`What are the most important things I should focus on in the visual for "${sectionHeading}"?`)}
              >
                <Lightbulb className="w-4 h-4 mr-2" /> What should I focus on?
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    }

    // Display metadata as cards
    if (visualMetadata) {
      return (
        <Collapsible open={showGuidance} onOpenChange={setShowGuidance}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <ChevronDown className={`w-4 h-4 mr-2 transition-transform ${showGuidance ? 'rotate-180' : ''}`} />
              {showGuidance ? 'Hide' : 'Show'} Learning Guide
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Walk Through Card */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
                      <Eye className="h-4 w-4" />
                      Walk me through this
                    </CardTitle>
                    {onAskAI && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                        onClick={() => onAskAI(
                          `Based on this visual about "${sectionHeading}": ${visualMetadata.walk_through}. Can you explain this to me step-by-step in more detail?`
                        )}
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Discuss with AI
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {visualMetadata.walk_through}
                  </p>
                </CardContent>
              </Card>

              {/* Focus Points Card */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-700">
                      <Lightbulb className="h-4 w-4" />
                      What should I focus on?
                    </CardTitle>
                    {onAskAI && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                        onClick={() => onAskAI(
                          `Regarding the visual for "${sectionHeading}": ${visualMetadata.focus_points}. Can you help me understand why these points are important and how to apply them?`
                        )}
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Discuss with AI
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {visualMetadata.focus_points}
                  </p>
                </CardContent>
              </Card>
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return null;
  };

  return (
    <>
      {/* Theater mode overlay */}
      {isTheaterMode && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          {/* Theater mode content */}
          <div className="flex-1 flex flex-col p-4">
            <div className="relative flex-1 bg-white rounded-lg overflow-hidden shadow-2xl">
              <iframe
                ref={iframeRef}
                srcDoc={visualHtml}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
                title={`Interactive visual for ${sectionHeading}`}
              />

              {/* Theater mode controls */}
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={toggleTheaterMode}
                  className="shadow-md"
                >
                  <Minimize2 className="w-4 h-4 mr-2" />
                  Exit Theater
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCollapse}
                  className="shadow-md"
                >
                  <ChevronDown className="w-4 h-4 mr-2 rotate-180" />
                  Close
                </Button>
              </div>

              {/* Floating AI buttons overlay */}
              {onAskAI && (
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-white/95 hover:bg-white text-blue-700 shadow-lg border border-blue-200"
                    onClick={() => onAskAI(`Walk me through the visual content in "${sectionHeading}" step by step, as if you were my teacher.`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Walk me through this
                  </Button>
                  <Button
                    size="sm"
                    className="bg-white/95 hover:bg-white text-purple-700 shadow-lg border border-purple-200"
                    onClick={() => onAskAI(`What are the most important things I should focus on in the visual for "${sectionHeading}"?`)}
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    What should I focus on?
                  </Button>
                </div>
              )}

              {/* Completion badge */}
              {isCompleted && (
                <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-md">
                  <CheckCircle2 className="w-3 h-3" />
                  Viewed
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Normal view */}
      <div className="my-6 space-y-4">
        {!isExpanded ? (
          // YouTube-style thumbnail preview
          renderThumbnail()
        ) : (
          // Expanded view with iframe and guidance
          <div className="space-y-4">
            {/* Visual content in iframe */}
            <div className="relative border rounded-lg overflow-hidden bg-white shadow-sm">
              <iframe
                ref={iframeRef}
                srcDoc={visualHtml}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-[500px] border-0"
                title={`Interactive visual for ${sectionHeading}`}
              />

              {/* Controls */}
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={toggleTheaterMode}
                  className="shadow-md"
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Theater
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCollapse}
                  className="shadow-md"
                >
                  <ChevronDown className="w-4 h-4 mr-2 rotate-180" />
                  Collapse
                </Button>
              </div>

              {/* Floating AI buttons overlay */}
              {onAskAI && (
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-white/95 hover:bg-white text-blue-700 shadow-lg border border-blue-200"
                    onClick={() => onAskAI(`Walk me through the visual content in "${sectionHeading}" step by step, as if you were my teacher.`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Walk me through this
                  </Button>
                  <Button
                    size="sm"
                    className="bg-white/95 hover:bg-white text-purple-700 shadow-lg border border-purple-200"
                    onClick={() => onAskAI(`What are the most important things I should focus on in the visual for "${sectionHeading}"?`)}
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    What should I focus on?
                  </Button>
                </div>
              )}

              {/* Completion badge for expanded view */}
              {isCompleted && (
                <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-md">
                  <CheckCircle2 className="w-3 h-3" />
                  Viewed
                </div>
              )}
            </div>

            {/* Guidance cards (always visible when expanded, but collapsible on mobile) */}
            <div className="space-y-3">
              {renderGuidanceCards()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
