import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Eye, AlertCircle, RotateCcw, Maximize2 } from 'lucide-react';

interface VisualContentProps {
  content: {
    description: string;
    p5_code: string;
    interactive_elements: string[];
  };
  isCompleted: boolean;
  onComplete: () => void;
  onAskAI: (message: string) => void;
}

export function VisualContent({ content, isCompleted, onComplete, onAskAI }: VisualContentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!content.p5_code || !iframeRef.current) return;

    setError(null);
    setIsLoading(true);

    const iframeContent = `
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
            window.addEventListener('error', function(e) {
              console.error('P5.js Error:', e.error);
              document.body.innerHTML = '<div class="error-message"><h3>Visualization Error</h3><p>' + e.error.message + '</p></div>';
              window.parent.postMessage({ type: 'p5js-error', error: e.error.message }, '*');
            });

            window.addEventListener('message', function(event) {
              if (event.data.type === 'reset-visualization') {
                if (typeof redraw === 'function') {
                  redraw();
                }
              }
            });

            try {
              ${content.p5_code}
              window.parent.postMessage({ type: 'p5js-loaded' }, '*');
            } catch (e) {
              console.error("Error executing p5.js sketch:", e);
              document.body.innerHTML = '<div class="error-message"><h3>Code Execution Error</h3><p>' + e.message + '</p></div>';
              window.parent.postMessage({ type: 'p5js-error', error: e.message }, '*');
            }
          </script>
        </body>
      </html>
    `;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'p5js-loaded') {
        setIsLoading(false);
        setError(null);
      } else if (event.data.type === 'p5js-error') {
        setError(event.data.error);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    iframeRef.current.srcdoc = iframeContent;

    return () => window.removeEventListener('message', handleMessage);
  }, [content.p5_code]);

  const resetVisualization = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'reset-visualization' }, '*');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <CardTitle className="text-2xl text-red-600">Visualization Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-red-700 mb-4">{error}</p>
              <p className="text-red-600 text-sm mb-4">{content.description}</p>
              <Button 
                variant="outline" 
                onClick={() => onAskAI("Can you explain how this visualization should work?")}
              >
                Ask AI about this visualization
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'w-full'}`}>
      <Card className="shadow-lg h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle className="text-2xl">Interactive Visualization</CardTitle>
                <p className="text-muted-foreground">{content.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetVisualization}
                disabled={isLoading}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading visualization...</p>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              title="Interactive Visualization"
              sandbox="allow-scripts allow-same-origin"
              className={`w-full border-0 rounded-lg ${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-[calc(100vh-300px)]'}`}
            />
          </div>

          {/* Interactive Elements Info */}
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 mb-2">Interactive Elements:</h4>
            <ul className="space-y-1">
              {content.interactive_elements.map((element, index) => (
                <li key={index} className="text-purple-800 text-sm">• {element}</li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onAskAI("How does this interactive visualization work?")}
              className="flex-1"
            >
              Ask AI about this
            </Button>
            <Button
              variant="outline"
              onClick={() => onAskAI("What should I click on in this visualization?")}
              className="flex-1"
            >
              How do I use this?
            </Button>
          </div>
          
          <div className="pt-6 border-t">
            <Button 
              onClick={onComplete}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={isCompleted}
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completed
                </>
              ) : (
                'Mark as Complete'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}