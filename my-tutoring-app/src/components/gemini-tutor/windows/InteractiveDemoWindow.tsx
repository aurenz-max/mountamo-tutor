// src/components/windows/InteractiveDemoWindow.tsx
import React, { useEffect, useRef, useState } from 'react';

interface InteractiveDemoWindowProps {
  content: {
    format: 'p5js' | 'html' | string; // Allow for other formats in future
    code: string;
    description?: string;
  } | null;
  isLoading: boolean;
}

const InteractiveDemoWindow: React.FC<InteractiveDemoWindowProps> = ({ content, isLoading }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (iframeRef.current && content) {
      const iframe = iframeRef.current;
      let iframeContent = '';

      if (content.format === 'p5js') {
        iframeContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>p5.js Sketch</title>
              <style> body { padding: 0; margin: 0; overflow: hidden; } </style>
              <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.js"></script>
              <!-- <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/addons/p5.sound.min.js"></script> -->
            </head>
            <body>
              <script>
                try {
                  ${content.code}
                } catch (e) {
                  document.body.innerHTML = '<div style="color: red; padding: 10px;">Error in p5.js sketch: ' + e.message + '</div>';
                  console.error("Error executing p5.js sketch:", e);
                }
              </script>
            </body>
          </html>
        `;
      } else if (content.format === 'html') {
        // For HTML, we can directly use the provided code if it's a full document,
        // or wrap it if it's a snippet.
        // Assuming Gemini sends a full HTML structure for simplicity here.
        iframeContent = content.code;
      } else {
        setError(`Unsupported format: ${content.format}`);
        return;
      }

      // iframe.srcdoc is better for security and managing content.
      try {
        iframe.srcdoc = iframeContent;
      } catch (e: any) {
        setError(`Error setting iframe content: ${e.message}`);
        console.error("Error setting iframe srcdoc:", e);
      }

    } else if (iframeRef.current) {
      // Clear iframe if no content
      iframeRef.current.srcdoc = '<html><body style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: sans-serif; color: #777;">No interactive demo loaded.</body></html>';
    }
  }, [content]);

  if (isLoading) {
    return (
      <div className="w-full h-64 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center p-4 shadow-md">
        <p className="text-gray-500 dark:text-gray-400">Loading interactive demo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-64 bg-red-100 dark:bg-red-900 border border-red-400 rounded-lg flex flex-col items-center justify-center p-4 shadow-md">
        <p className="text-red-700 dark:text-red-300 font-semibold">Error loading demo:</p>
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        {content?.description && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Attempted to load: {content.description}</p>}
      </div>
    );
  }
  
  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {content?.description && (
        <p className="p-2 text-xs text-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {content.description}
        </p>
      )}
      <iframe
        ref={iframeRef}
        title="Interactive Demo"
        sandbox="allow-scripts allow-same-origin" // allow-same-origin is needed for p5.js to load assets if it were to use them from the same origin as the iframe's src. For srcdoc, it's less critical but good practice.
        className="w-full h-full border-0"
        // Initial empty content or loading state
        srcDoc='<html><body style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: sans-serif; color: #777;">Select a lesson to see an interactive demo.</body></html>'
      />
    </div>
  );
};

export default InteractiveDemoWindow;