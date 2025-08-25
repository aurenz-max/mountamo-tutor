import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Eye, Maximize2, PlayCircle, RotateCcw } from 'lucide-react';

// Define the visual content type to match the existing VisualContentProps
interface VisualContentType {
  description: string;
  p5_code: string;
  interactive_elements: string[];
}

interface VisualExplorerContentProps {
  visuals: VisualContentType[];
  onAskAI: (message: string) => void;
}

export function VisualExplorerContent({ visuals, onAskAI }: VisualExplorerContentProps) {
  const [selectedVisual, setSelectedVisual] = useState<VisualContentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleLaunchVisual = (visual: VisualContentType) => {
    setSelectedVisual(visual);
    setIsModalOpen(true);
    setIframeKey(prev => prev + 1); // Force iframe reload
  };

  const handleCloseModal = () => {
    setSelectedVisual(null);
    setIsModalOpen(false);
  };

  const handleReset = () => {
    setIframeKey(prev => prev + 1); // Force iframe reload to reset the visualization
  };

  const isFullHtmlContent = (content: string) => {
    return content.trim().toLowerCase().startsWith('<!doctype html') || 
           content.trim().toLowerCase().startsWith('<html');
  };

  if (!visuals || visuals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-600" />
            Visual Explorer
          </CardTitle>
          <p className="text-muted-foreground">
            No interactive visualizations are currently available for this lesson.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-600" />
            Visual Explorer
          </CardTitle>
          <p className="text-muted-foreground">
            Explore interactive demonstrations for this lesson
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visuals.map((visual, index) => (
              <Card 
                key={index}
                className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-purple-300 group"
                onClick={() => handleLaunchVisual(visual)}
              >
                <CardContent className="p-6">
                  {/* Thumbnail/Preview */}
                  <div className="flex items-center justify-center h-32 bg-purple-50 rounded-lg mb-4 group-hover:bg-purple-100 transition-colors">
                    <PlayCircle className="w-12 h-12 text-purple-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="font-semibold text-lg mb-3 line-clamp-2">
                    {visual.description}
                  </h3>
                  
                  {/* Interactive Elements Tags */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {visual.interactive_elements.slice(0, 3).map((element, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {element.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                    {visual.interactive_elements.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{visual.interactive_elements.length - 3} more
                      </Badge>
                    )}
                  </div>
                  
                  {/* Launch Button */}
                  <Button 
                    className="w-full group-hover:bg-purple-600 group-hover:text-white transition-colors"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunchVisual(visual);
                    }}
                  >
                    <Maximize2 className="w-4 h-4 mr-2" />
                    Launch Demo
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal for Visual Interaction */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-600" />
              {selectedVisual?.description}
            </DialogTitle>
          </DialogHeader>
          
          {/* Visual Content Display */}
          <div className="flex-1 min-h-0 flex flex-col">
            {selectedVisual && (
              <>
                {/* Visual Display */}
                <div className="flex-1 min-h-0">
                  {isFullHtmlContent(selectedVisual.p5_code) ? (
                    // Full HTML content - use iframe with srcDoc
                    <iframe
                      key={iframeKey}
                      srcDoc={selectedVisual.p5_code}
                      sandbox="allow-scripts"
                      className="w-full h-full border border-gray-200 rounded-lg"
                      title={`Visual: ${selectedVisual.description}`}
                    />
                  ) : (
                    // p5.js code - embed in HTML wrapper
                    <iframe
                      key={iframeKey}
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                              body { 
                                padding: 0; 
                                margin: 0; 
                                overflow: hidden; 
                                background: #f8f9fa;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                              }
                              .error-message {
                                color: #dc3545;
                                padding: 20px;
                                text-align: center;
                                background: #f8f9fa;
                                border: 2px solid #dc3545;
                                margin: 20px;
                                border-radius: 8px;
                              }
                            </style>
                            <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.js"></script>
                          </head>
                          <body>
                            <script>
                              try {
                                ${selectedVisual.p5_code}
                              } catch (e) {
                                document.body.innerHTML = '<div class="error-message"><h3>Code Execution Error</h3><p>' + e.message + '</p></div>';
                              }
                            </script>
                          </body>
                        </html>
                      `}
                      sandbox="allow-scripts"
                      className="w-full h-full border border-gray-200 rounded-lg"
                      title={`Visual: ${selectedVisual.description}`}
                    />
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      size="sm"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => onAskAI(`Walk me through this visualization: "${selectedVisual.description}"`)}
                      variant="outline"
                      size="sm"
                    >
                      Ask AI about this visual
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}