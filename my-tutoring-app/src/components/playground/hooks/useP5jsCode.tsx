import { useState, useRef, useCallback, useEffect } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { markedHighlight } from 'marked-highlight';

// p5.js CDN URL
const p5jsCdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js';

// Configure marked with syntax highlighting
marked.use(markedHighlight({
  async: true,
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
}));

export function useP5jsCode(initialCode: string) {
  // State
  const [code, setCode] = useState<string>(initialCode);
  const [codeSyntaxHtml, setCodeSyntaxHtml] = useState<string>('');
  const [codeHasChanged, setCodeHasChanged] = useState<boolean>(true);
  const [codeNeedsReload, setCodeNeedsReload] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  
  // Refs
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastErrorRef = useRef<string>('');
  const reportedErrorRef = useRef<boolean>(false);
  
  // Register iframe reference
  const registerIframeRef = useCallback((ref: HTMLIFrameElement) => {
    iframeRef.current = ref;
  }, []);
  
  // Update the syntax highlighted HTML whenever code changes
  useEffect(() => {
    const updateSyntaxHighlighting = async () => {
      const formattedCode = await marked.parse('```javascript\n' + code + '\n```');
      setCodeSyntaxHtml(formattedCode);
    };
    
    updateSyntaxHighlighting();
  }, [code]);
  
  // Run code in iframe
  const runCode = useCallback((codeToRun: string) => {
    if (!iframeRef.current) return;
    
    reportedErrorRef.current = false;
    lastErrorRef.current = '';

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

    iframeRef.current.setAttribute('srcdoc', htmlContent);
    setCodeNeedsReload(false);
  }, []);
  
  // Function to update code
  const updateCode = useCallback(async (newCode: string) => {
    setCode(newCode);
    runCode(newCode);
    setCodeHasChanged(false);
    
    const formattedCode = await marked.parse('```javascript\n' + newCode + '\n```');
    setCodeSyntaxHtml(formattedCode);
  }, [runCode]);
  
  // Function to handle code edits from the editor
  const editCode = useCallback((newCode: string) => {
    setCode(newCode);
    setCodeHasChanged(true);
    setCodeNeedsReload(true);
  }, []);
  
  // Play/Stop functions
  const playSketch = useCallback(() => {
    if (isRunning) return;
    if (codeHasChanged) {
      runCode(code);
    }
    setIsRunning(true);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage('resume', '*');
    }
  }, [isRunning, codeHasChanged, code, runCode]);
  
  const stopSketch = useCallback(() => {
    if (!isRunning) return;
    setIsRunning(false);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage('stop', '*');
    }
  }, [isRunning]);
  
  // Reload code
  const reloadCode = useCallback(() => {
    runCode(code);
    setIsRunning(true);
  }, [code, runCode]);
  
  // Clear code
  const clearCode = useCallback(() => {
    updateCode(initialCode);
    setCodeHasChanged(true);
  }, [initialCode, updateCode]);
  
  // Function to handle errors from the iframe
  const handleRuntimeError = useCallback((errorCallback: (error: string) => void) => {
    const handleMessage = (msg: MessageEvent) => {
      if (msg.data && typeof msg.data === 'string') {
        try {
          const message = JSON.parse(msg.data).message;
          if (message && !reportedErrorRef.current) {
            reportedErrorRef.current = true;
            if (lastErrorRef.current !== message) {
              errorCallback(message);
            }
            lastErrorRef.current = message;
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
  }, []);
  
  return {
    code,
    codeSyntaxHtml,
    codeHasChanged,
    codeNeedsReload,
    isRunning,
    updateCode,
    editCode,
    runCode,
    playSketch,
    stopSketch,
    reloadCode,
    clearCode,
    registerIframeRef,
    handleRuntimeError
  };
}