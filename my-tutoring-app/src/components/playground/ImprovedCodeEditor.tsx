import React, { useEffect, useRef } from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  readOnly: boolean;
  codeSyntaxHtml: string;
}

const ImprovedCodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  readOnly,
  codeSyntaxHtml
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightDivRef = useRef<HTMLDivElement>(null);

  // Sync scroll positions between the textarea and the syntax highlighting div
  const handleScroll = () => {
    if (highlightDivRef.current && textareaRef.current) {
      highlightDivRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightDivRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Initial setup and focus
  useEffect(() => {
    // Set initial scroll position
    handleScroll();
    
    // Set focus when not readonly
    if (!readOnly && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [code, readOnly]);

  return (
    <div className="relative h-full min-h-64 overflow-hidden rounded bg-gray-50 dark:bg-gray-900 font-mono text-sm">
      {/* Syntax Highlighting Layer */}
      <div 
        ref={highlightDivRef}
        className="absolute inset-0 p-4 overflow-auto"
        dangerouslySetInnerHTML={{ 
          __html: codeSyntaxHtml || `<pre class="hljs language-javascript"><code>${code}</code></pre>` 
        }}
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Editable Textarea Layer */}
      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        className="absolute inset-0 w-full h-full p-4 bg-transparent caret-black dark:caret-white resize-none focus:outline-none focus:ring-0 focus:border-0"
        spellCheck="false"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        style={{ 
          color: 'transparent',
          caretColor: 'currentColor'
        }}
        readOnly={readOnly}
        aria-label="Code editor"
      />
      
      {/* Read-only overlay */}
      {readOnly && (
        <div className="absolute inset-0 bg-black bg-opacity-5 dark:bg-opacity-20 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-3 py-1 rounded-md shadow-sm text-xs">
            Editing disabled while AI is generating
          </div>
        </div>
      )}
    </div>
  );
};

export default ImprovedCodeEditor;