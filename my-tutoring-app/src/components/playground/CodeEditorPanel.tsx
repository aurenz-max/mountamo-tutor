import React from 'react';
import { Button } from "@/components/ui/button";
import { Save } from 'lucide-react';
import CodeEditor from './CodeEditor'; // Reusing existing CodeEditor component

interface CodeEditorPanelProps {
  code: string;
  codeSyntaxHtml: string;
  onChange: (code: string) => void;
  readOnly: boolean;
  onSave: () => void;
}

const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  code,
  codeSyntaxHtml,
  onChange,
  readOnly,
  onSave
}) => {
  return (
    <>
      <div className="p-2 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={readOnly}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Code
        </Button>
      </div>
      
      {/* Reusing the existing CodeEditor component */}
      <CodeEditor 
        code={code}
        onChange={onChange}
        readOnly={readOnly}
        codeSyntaxHtml={codeSyntaxHtml}
      />
    </>
  );
};

export default CodeEditorPanel;