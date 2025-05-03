// This is a focused fix for the code editor part that's not scrolling properly

import React, { useEffect, useRef } from 'react';

// Code Editor component to fix scrolling synchronization
const CodeEditor = ({ code, onChange, readOnly, codeSyntaxHtml }) => {
  const textareaRef = useRef(null);
  const highlightDivRef = useRef(null);

  // Sync scroll positions between the textarea and the syntax highlighting div
  const handleScroll = () => {
    if (highlightDivRef.current && textareaRef.current) {
      highlightDivRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightDivRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div 
        ref={highlightDivRef}
        className="absolute inset-0 p-4 z-10 pointer-events-none overflow-hidden"
        dangerouslySetInnerHTML={{ __html: codeSyntaxHtml }} 
      />
      <textarea
        ref={textareaRef}
        className="absolute inset-0 p-4 font-mono text-transparent bg-transparent caret-black resize-none focus:outline-none z-20 overflow-auto"
        value={code}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        aria-label="P5.js code editor"
        spellCheck="false"
      />
    </div>
  );
};

export default CodeEditor;