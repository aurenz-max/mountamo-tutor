import React, { useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import PlaybackControls from './ui/PlaybackControls';

// p5.js CDN URL
const p5jsCdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js';

interface PreviewPanelProps {
  code: string;
  isRunning: boolean;
  codeNeedsReload: boolean;
  onReload: () => void;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  onError: (errorMessage: string) => void;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  code,
  isRunning,
  codeNeedsReload,
  onReload,
  onPlay,
  onStop,
  onClear,
  onError
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (msg: MessageEvent) => {
      if (msg.data && typeof msg.data === 'string') {
        try {
          const message = JSON.parse(msg.data).message;
          if (message) {
            onError(message);
          }
        } catch (e) {
          console.error('Error parsing message from iframe:', e);
        }
      }
    };

    window.addEventListener('message', handleMessage, false);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onError]);
  
  // Important: Run the code when the component mounts or when code changes
  useEffect(() => {
    runCode(code);
  }, [code]); // This will ensure the code runs when it changes
  
  // Toggle fullscreen
  const toggleFullScreen = () => {
    const previewPanel = document.querySelector('.preview-panel');
    if (!previewPanel) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      previewPanel.requestFullscreen();
    }
  };
  
  // Run code in iframe - Include this directly in the component
  const runCode = (codeToRun: string) => {
    if (!iframeRef.current) return;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>p5.js Sketch</title>
          <style>
              body { 
                margin: 0; 
                padding: 0; 
                overflow: hidden; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                width: 100vw;
                background-color: #ffffff; 
              }
              canvas { 
                display: block; 
                margin: 0 auto; 
              }
              .console { 
                position: absolute; 
                bottom: 0; 
                left: 0; 
                width: 100%; 
                background: rgba(0, 0, 0, 0.8); 
                padding: 1em; 
                margin: 0; 
                color: #f44336; 
                font-family: 'Consolas', monospace; 
                border-top: 2px solid #f44336; 
              }
          </style>
          <script src="${p5jsCdnUrl}"></script>
          <script>
            window.addEventListener('message', (event) => {
                if (event.data === 'stop' && typeof noLoop === 'function') { 
                  noLoop(); 
                  console.log('Sketch stopped (noLoop)'); 
                } else if (event.data === 'resume' && typeof loop === 'function') { 
                  loop(); 
                  console.log('Sketch resumed (loop)'); 
                }
            }, false);
            
            // Capture console errors and forward them to the parent window
            window.onerror = function(message, source, lineno, colno, error) {
              parent.postMessage(
                JSON.stringify({
                  message: 'Error: ' + message + ' (Line: ' + lineno + ', Col: ' + colno + ')'
                }),
                '*'
              );
              return true;
            };
            
            // Enhanced createCanvas to support flexible sizing
            const originalCreateCanvas = window.createCanvas;
            window.createCanvas = function() {
              let args = Array.from(arguments);
              
              // Make canvas use full container size if windowWidth/windowHeight is used
              if (args[0] === windowWidth) {
                args[0] = window.innerWidth;
              }
              if (args[1] === windowHeight) {
                args[1] = window.innerHeight;
              }
              
              return originalCreateCanvas.apply(this, args);
            };

            // Handle window resize
            window.addEventListener('resize', function() {
              if (typeof windowResized === 'function') {
                windowResized();
              }
            });
            
            // Capture console.log output
            const originalConsoleLog = console.log;
            console.log = function() {
              originalConsoleLog.apply(console, arguments);
            };
          </script>
      </head>
      <body>
          <script>
              // Basic error handling within the iframe
              try {
                  ${codeToRun}
              } catch (error) {
                  console.error("Error in sketch:", error);
                  parent.postMessage(
                    JSON.stringify({
                      message: error.toString()
                    }),
                    '*'
                  );
                  document.body.innerHTML = '<pre class="console">Error: ' + error.message + '\\n\\nCheck the browser console for details or ask Gemini to fix it.</pre>';
              }
          </script>
      </body>
      </html>
    `;

    console.log('Setting iframe content with code length:', codeToRun.length);
    iframeRef.current.setAttribute('srcdoc', htmlContent);
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 w-full h-full border-0"
          title="P5.js Canvas Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      
      <Separator />
      
      <div className="p-2 flex items-center justify-center space-x-2">
        <PlaybackControls 
          isRunning={isRunning}
          codeNeedsReload={codeNeedsReload}
          onReload={() => runCode(code)}
          onPlay={onPlay}
          onStop={onStop}
          onClear={onClear}
          onToggleFullscreen={toggleFullScreen}
        />
      </div>
    </Card>
  );
};

export default PreviewPanel;